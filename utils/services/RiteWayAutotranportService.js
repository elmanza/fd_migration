const moment = require('moment');

const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;

const riteWay  = require("../../models/RiteWay/_riteWay");
const {ritewayDB} = require('../../config/database');


class RiteWayAutotranportService{
    constructor(){
        this.memberResource = new MemberResource();
        this.entityResource = new EntityResource();
    }

    async getRWCity(stateAbbre, cityName){
        let citySQL = `
                SELECT city.*
                FROM cities
                INNER JOIN states on cities.state_id = states.id
                WHERE states.abbreviation ilike '${stateAbbre}' and cities.name = '${cityName}'
            `;
        return await ritewayDB.query(citySQL, { type: ritewayDB.QueryTypes.SELECT});
    }

    async parseFDData(FDEntity){
        let rwData = {};

        //Quote Data ===================================================
        rwData.quantity = FD.vehicles.length;
        rwData.estimated_ship_date = FDEntity.est_ship_date;
        rwData.ship_via = (FDEntity.ship_via-1>0?FDEntity.ship_via-1:0);

        rwData.origin_zip = FDEntity.origin.zip;
        rwData.origin_address = FDEntity.origin.address1;
        rwData.originCity = await this.getRWCity(FDEntity.origin.state, FDEntity.origin.state);

        rwData.destination_zip = FDEntity.destination.zip;
        rwData.destination_address = FDEntity.destination.address1;
        rwData.destinationCity = await this.getRWCity(FDEntity.destination.state, FDEntity.destination.state);

        rwData.company = null;
        rwData.user = await riteWay.User.findOne(FDEntity.shipper.email);

        if(rwData.user != null){
            if(rwData.user.company_id != null && rwData.user.company_id != '' ){
                rwData.company = await riteWay.Company.findByPk(rwData.user.company_id);
            }
        }
        
        if(rwData.company == null){
            if(FDEntity.shipper.company != null && FDEntity.shipper.company.trim() != '' ){
                rwData.company = await riteWay.Company.findOne({
                    where: {
                        [dbOp.and] : [
                            Sequelize.where(
                                Sequelize.col('name'),
                                'ILIKE',
                                `%${FDEntity.shipper.company.trim()}%`
                            )
                        ]
                    }
                });
            }
        }

        if(FDEntity.type < 3){
            if(FDEntity.tariff > 0){
                rwData.tariff = FDEntity.tariff;
                rwData.state = 'offered';
            }
            else{
                rwData.state = 'waiting';
            }
        }
        else{
            rwData.state = 'accepted'
        }

        //Order Data ===================================================
        if(rwData.state == 'accepted'){
            rwData.order = {};

        }
        return rwData;
    }


    async createUser(fdOperator){        
        let riteWayOperator = await riteWay.User.findOne({
            where: {
                username:fdOperator.email
            }
        });

        if(!riteWayOperator){
            let name = fdOperator.contactname.split(' ');                 

            riteWayOperator = await riteWay.User.create({
                name: name[0],
                last_name: name.slice(1).join(' '),
                username: fdOperator.email,
                password: '',
                photo: '',
                phone: fdOperator.phone,
                shipper_type: '',
                is_company_admin: false,
                isOperator: true,
                company_id: null
            });
        }

        return riteWayOperator;
    }

    importQuote(FDEntity){
        let rwData = this.parseFDData(FDEntity);
    }
}