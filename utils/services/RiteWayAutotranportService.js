const moment = require('moment');

const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;

const riteWay  = require("../../models/RiteWay/_riteWay");
const {ritewayDB} = require('../../config/database');


class RiteWayAutotranportService{
    constructor(){}

    _parseStatus(status){
        let validStatus = ['active', 'onhold', 'cancelled', 'posted', 'notsigned', 'dispatched', 'issues', 'pickedup', 'delivered'];
        if(typeof validStatus[status-1] == 'undefined'){
            throw "Status not valid";
        }
        return validStatus[status-1];
    }

    async getRWCity(stateAbbre, cityName){
        let citySQL = `
                SELECT cities.*
                FROM cities
                INNER JOIN states on cities.state_id = states.id
                WHERE states.abbreviation ilike '${stateAbbre}' and cities.name ilike '${cityName}'
            `;
        console.log(citySQL);
        return await ritewayDB.query(citySQL, {nest: true, type: ritewayDB.QueryTypes.SELECT});
    }

    async parseFDData(FDEntity){
        let rwData = {};

        //Quote Data ===================================================
        rwData.quantity = FDEntity.vehicles.length;
        rwData.estimated_ship_date = FDEntity.est_ship_date;
        rwData.ship_via = (FDEntity.ship_via-1>0?FDEntity.ship_via-1:0);

        rwData.origin_zip = FDEntity.origin.zip;
        rwData.origin_address = FDEntity.origin.address1;
        let originCity = await this.getRWCity(FDEntity.origin.state, FDEntity.origin.city);
        rwData.originCity = originCity.length > 0 ? originCity[0].id : null;

        rwData.destination_zip = FDEntity.destination.zip;
        rwData.destination_address = FDEntity.destination.address1;
        let destinationCity = await this.getRWCity(FDEntity.destination.state, FDEntity.destination.city);
        rwData.destinationCity = destinationCity.length > 0 ? destinationCity[0].id : null;

        rwData.company = null;
        rwData.user = await riteWay.User.findOne({
            where: {
                username: FDEntity.shipper.email
            }
        });
        //user................
        if(rwData.user != null){
            if(rwData.user.company_id != null && rwData.user.company_id != '' ){
                rwData.company = await riteWay.Company.findByPk(rwData.user.company_id);
            }
        }
        else{
            rwData.user = {
                isNew: true,
                name: FDEntity.fname,
                last_name: FDEntity.lname,
                username: FDEntity.shipper.email,
                password: '',
                photo: '',
                phone: FDEntity.shipper.phone1,
                shipper_type: '',
                is_company_admin: false,
                isOperator: false,
                company_id: null
            };
        }
        //company................
        if(rwData.company == null){
            if(FDEntity.shipper.company != null && FDEntity.shipper.company.trim() != '' ){
                rwData.company = await riteWay.Company.findOne({
                    where: {
                        [dbOp.and] : [
                            Sequelize.where(
                                Sequelize.col('name'),
                                'ILIKE',
                                `${FDEntity.shipper.company.trim()}`
                            )
                        ]
                    }
                });
            }
        }

        if(rwData.company == null){
            let opQuery = `
            select users.id, count(companies.id) from users 
            left join companies on companies.operator_id  = users.id
            where users.is_operator = true
            group by users.id order by count(companies.id) asc limit 1
            `;
            let operatorID = await ritewayDB.query(opQuery, { nest: true, type: Sequelize.QueryTypes.SELECT });
            if(operatorID.length > 0){
                rwData.company = {
                    isNew: true,
                    name: FDEntity.shipper.company.trim(),
                    photo: '',
                    email: FDEntity.shipper.email,
                    phone: FDEntity.shipper.phone1,
                    address: FDEntity.shipper.address1,
                    operator_id: operatorID[0].id
                };
            }
        }
        //quote status................
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
        //vehicles................
        rwData.vehicles = [];
        FDEntity.vehicles.forEach(async (vehicle) => {

            let vehicleType = await riteWay.VehicleType.findOne({
                where: Sequelize.where(
                    Sequelize.col('name'),
                    'ILIKE',
                    `%${vehicle.type}%`
                )
            });

            let vehicleModel = null;
            let vehicleMaker = await riteWay.VehicleMakers.findOne({
                where: Sequelize.where(
                    Sequelize.col('name'),
                    'ILIKE',
                    `%${vehicle.make}%`
                )
            });

            if(vehicleMaker){
                vehicleModel = await riteWay.VehicleModel.findOne({
                    where: {
                        [dbOp.and] : [
                            Sequelize.where(
                                Sequelize.col('id'),
                                'ILIKE',
                                `%${vehicle.model}%`
                            ),
                            {
                                maker_id: vehicleMaker.id
                            }
                        ]
                    }
                });
            }

            rwData.vehicles.push({
                year: vehicle.year,
                lot: vehicle.lot,
                vin: vehicle.vin,
                plate: vehicle.plate,
                state: vehicle.state,
                color: vehicle.color,
                inop: vehicle.inop,
                tariff: vehicle.tariff,
                carrier_pay: vehicle.carrier_pay,
                deposit: vehicle.deposit,
                type_id: vehicleType?vehicleType.id:null,
                model_id: vehicleModel?vehicleModel.id:null,
            });
        });

        //Order Data ===================================================
        if(rwData.state == 'accepted'){
            rwData.order = {
                status: this._parseStatus(FDEntity.status),
                estimated_delivery_date: FDEntity.delivery_date?FDEntity.delivery_date:FDEntity.avail_pickup_date,
                delivered_at: FDEntity.delivery_date,
                picked_up_at: FDEntity.actual_pickup_date
            };

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

    async importQuote(FDEntity){
        let rwData = await this.parseFDData(FDEntity);
        console.log(JSON.parse(JSON.stringify(rwData)));
    }
}

module.exports = RiteWayAutotranportService;