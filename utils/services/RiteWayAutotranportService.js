const moment = require('moment');

const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;

const riteWay  = require("../../models/RiteWay/_riteWay");
const StageQuote = require('../../models/Stage/quote');

const {ritewayDB} = require('../../config/database');

const Crypter = require('../crypter');

class RiteWayAutotranportService{
    constructor(){
        this.quoteIncludeData = [
            {
                model: riteWay.Order,
                require: false,
                include: [
                    {
                        model: riteWay.Location,
                        as: 'originLocation',
                        include: [
                            {
                                model: riteWay.ContactInformation
                            },
                            {
                                model: riteWay.TypeAddress
                            }
                        ]
                    },
                    {
                        model: riteWay.Location,
                        as: 'destinationLocation',
                        include: [
                            {
                                model: riteWay.ContactInformation
                            },
                            {
                                model: riteWay.TypeAddress
                            }
                        ]
                    }
                ]
            },
            {
                model: riteWay.Company,
                require: true,
                include: [{
                    model: riteWay.User,
                    require: true,
                    as: 'operatorUser',
                    attributes: ['id', 'name', 'last_name', 'username', 'last_name'],
                }]
            },
            {
                model: riteWay.User,
                require: true,
                attributes: ['id', 'name', 'last_name', 'username', 'last_name'],
                include: [riteWay.Company]
            },
            {
                model:riteWay.City,
                require:true,
                as: 'originCity',
                attributes: ['id', 'name', 'zip'],
                include: [
                    {
                        model: riteWay.State,
                        attributes: ['id', 'abbreviation']
                    }
                ]
            },
            {
                model:riteWay.City,
                require:true,
                as: 'destinationCity',
                attributes: ['id', 'name', 'zip'],
                include: [
                    {
                        model: riteWay.State,
                        attributes: ['id', 'abbreviation']
                    }
                ]
            },
            {
                model: riteWay.Vehicle,
                as: 'vehicles',
                require: true,
                include: [
                    {
                        model: riteWay.VehicleModel,
                        attributes: ['name'],
                        include: [{
                            model: riteWay.VehicleMaker,
                            attributes: ['name']
                        }],
                        require:true
                    },
                    {
                        model:riteWay.VehicleType,
                        attributes: ['name'],
                    }
                ]
            },
            {
                model:StageQuote,
                as: 'stage_quote'
            }
        ];
    }

    _parseStatus(status){
        let validStatus = ['active', 'onhold', 'cancelled', 'posted', 'notsigned', 'dispatched', 'issues', 'pickedup', 'delivered'];
        if(typeof validStatus[status-1] == 'undefined'){
            throw "Status not valid";
        }
        return validStatus[status-1];
    }

    async getRWCity(stateAbbre, cityName){
        cityName = cityName.replace(/[^\w\s]/gi, '').trim();
        
        let citySQL = `
                SELECT cities.*
                FROM cities
                INNER JOIN states on cities.state_id = states.id
                WHERE states.abbreviation ilike '${stateAbbre}' and cities.name ilike '${cityName}'
            `;
        let cities = await ritewayDB.query(citySQL, {nest: true, type: ritewayDB.QueryTypes.SELECT});
        if(cities.length > 0){
            return cities[0];
        }
        else{
            return await this.createRWCity(stateAbbre, {
                name: cityName
            });
        }

    }

    async createRWCity(stateAbbre, cityData){
        let state = await riteWay.State.findOne({
            where: Sequelize.where(
                Sequelize.col('abbreviation'),
                'ilike',
                stateAbbre
            )
        });
        if(state){
            cityData.state_id = state.id;
            let city = await riteWay.City.create(cityData);
            return city;
        }
        return null;
    }

    async parseFDData(FDEntity){
        let rwData = {};

        //Quote Data ===================================================
        rwData.quantity = FDEntity.vehicles.length;
        rwData.estimated_ship_date = FDEntity.est_ship_date?FDEntity.est_ship_date:FDEntity.avail_pickup_date;
        rwData.ship_via = (FDEntity.ship_via-1>0?FDEntity.ship_via-1:0);
        rwData.created_at = FDEntity.created;
        rwData.updated_at = FDEntity.created;
        rwData.fd_id = FDEntity.id;
        rwData.fd_number = FDEntity.FDOrderID;
        rwData.tariff = Number(FDEntity.tariff);


        rwData.origin_zip = FDEntity.origin.zip ? FDEntity.origin.zip : '';
        rwData.origin_address = FDEntity.origin.address1;
        let originCity = await this.getRWCity(FDEntity.origin.state, FDEntity.origin.city);
        rwData.originCity = originCity ? originCity.id : null;

        rwData.destination_zip = FDEntity.destination.zip ? FDEntity.destination.zip : '';
        rwData.destination_address = FDEntity.destination.address1;
        let destinationCity = await this.getRWCity(FDEntity.destination.state, FDEntity.destination.city);
        rwData.destinationCity = destinationCity ? destinationCity.id : null;

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
            let password = await Crypter.encryptPassword(FDEntity.shipper.fname);

            rwData.user = {
                isNew: true,
                name: FDEntity.shipper.fname,
                last_name: FDEntity.shipper.lname,
                username: FDEntity.shipper.email,
                password: password,
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
            
            let operator = await riteWay.User.findOne({
                where:{
                    username: FDEntity.assignedTo.email
                }
            });
            let operatorID = [operator];
            if(operator  == null){
                let opQuery = `
                select users.id, count(companies.id) from users 
                left join companies on companies.operator_id  = users.id
                where users.is_operator = true
                group by users.id order by count(companies.id) asc limit 1
                `;
                operatorID = await ritewayDB.query(opQuery, { nest: true, type: Sequelize.QueryTypes.SELECT });
            }

            if(operatorID.length > 0){
                rwData.company = {
                    isNew: true,
                    name: FDEntity.shipper.company.trim(),
                    photo: '',
                    email: FDEntity.shipper.email,
                    phone: FDEntity.shipper.phone1,
                    address: FDEntity.shipper.address1,
                    operator_id: 631
                };
            }
        }
        //quote status................
        if(FDEntity.type < 3){
            if(Number(FDEntity.tariff) > 0){
                rwData.tariff = Number(FDEntity.tariff);
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
        for(let i=0; i<FDEntity.vehicles.length; i++){
            let vehicle = FDEntity.vehicles[i];
            let vehicleData = {
                year: vehicle.year,
                lot: vehicle.lot,
                vin: vehicle.vin,
                plate: vehicle.plate,
                state: vehicle.state,
                color: vehicle.color,
                inop: vehicle.inop,
                tariff: Number(vehicle.tariff),
                carrier_pay: Number(vehicle.carrier_pay),
                deposit: Number(vehicle.deposit),
            }

            let vehicleType = await riteWay.VehicleType.findOne({
                where: Sequelize.where(
                    Sequelize.col('name'),
                    'ILIKE',
                    `%${vehicle.type}%`
                )
            });

            let vehicleModel = null;
            let vehicleMaker = await riteWay.VehicleMaker.findOne({
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
                                Sequelize.col('name'),
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

            if(vehicleType){
                vehicleData.type_id = vehicleType.id
            }
            else{
                vehicleData.type = vehicle.type
            }

            if(vehicleModel){
                vehicleData.model_id = vehicleModel.id
            }
            else{
                vehicleData.model = vehicle.model;
                if(vehicleMaker){
                    vehicleData.maker_id = vehicleMaker.id;
                }
                else{
                    vehicleData.maker = vehicle.make;
                }
            }
            
            rwData.vehicles.push(vehicleData);           
        }

        //Order Data ===================================================
        rwData.order = null;
        if(rwData.state == 'accepted'){
            rwData.order = {
                status: this._parseStatus(FDEntity.status),
                estimated_delivery_date: FDEntity.delivery_date?FDEntity.delivery_date:FDEntity.avail_pickup_date,
                delivered_at: FDEntity.delivery_date,
                picked_up_at: FDEntity.actual_pickup_date
            };

            rwData.originLocation = {
                address: FDEntity.origin.address1,
                company_name: FDEntity.origin.company,
                type_address_id: FDEntity.origin.location_type=='Residential'?2:1,
                pickup_time_start: FDEntity.origin.hours,
                pickup_time_end: FDEntity.origin.hours,
                contact_information: {
                    name: FDEntity.origin.name,
                    phone: FDEntity.origin.phone1,
                    email: ''
                }
            };
    
            rwData.destinationLocation = {
                address: FDEntity.destination.address1,
                company_name: FDEntity.destination.company,
                type_address_id: FDEntity.destination.location_type=='Residential'?2:1,
                pickup_time_start: FDEntity.destination.hours,
                pickup_time_end: FDEntity.destination.hours,
                contact_information: {
                    name: FDEntity.destination.name,
                    phone: FDEntity.destination.phone1,
                    email: ''
                }
            };
    
    
            //Carrier................
            rwData.carrier = null;

            if(FDEntity.carrier){
                rwData.carrier = await riteWay.Carrier.findOne({
                    where: {
                        insurance_iccmcnumber: FDEntity.carrier.insurance_iccmcnumber.trim()
                    }
                });

                if(rwData.carrier == null){
                    let city = await this.getRWCity(FDEntity.carrier.state, FDEntity.carrier.city);
        
                    rwData.carrier = {
                        isNew: true,
                        company_name: FDEntity.carrier.company_name.trim(),
                        email: FDEntity.carrier.email,
                        address: FDEntity.carrier.address1,
                        zip: FDEntity.carrier.zip_code,
                        insurance_iccmcnumber: FDEntity.carrier.insurance_iccmcnumber.trim()
                    }
        
                    if(city.length > 0){
                        rwData.carrier.city_id = city[0].id;
                    }
                }

                if(rwData.carrier){
                    if(FDEntity.carrier.driver){
                        rwData.carrier.driver = {
                            name: FDEntity.carrier.driver.driver_name,
                            phone: FDEntity.carrier.driver.driver_phone
                        };
                    }                    
                }
            }      
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

    async importQuote(FDEntity, preCompany){

        let stageQuote = await StageQuote.findOne({
            where: {
                fdOrderId: FDEntity.FDOrderID
            }
        });
        if(stageQuote){
            return false;
        }

        let rwData = await this.parseFDData(FDEntity);

        let company = (preCompany? preCompany : rwData.company);
        let user = rwData.user;
        let quote = null;
        let order = null;
        let originLocation = null;
        let originContactInfo = null;
        let destinationLocation = null;
        let destinationContactInfo = null;
        let vehicles = [];
        let carrier = null;
        let driver = null;

        try {
            if(company.isNew && company.name.trim() != ''){
                company = await riteWay.Company.create(company);
            }
    
            if(rwData.user.isNew){
                user = await riteWay.User.create({...rwData.user, company_id: company.id});
            }
    
            rwData.destination_city = rwData.destinationCity;
            rwData.origin_city = rwData.originCity;
            rwData.company_id = company.id;
            rwData.user_create_id = user.id;

            quote = await riteWay.Quote.create(rwData);
            console.log(`quote created ${quote.id} company: ${company.id}`);

            for(let i = 0; i<rwData.vehicles.length; i++){
                let vehicle = rwData.vehicles[i];
                if(typeof vehicle.type != 'undefined'){
                    let type = await riteWay.VehicleType.create({
                        'name': vehicle.type.trim()
                    });
                    vehicle.type_id = type.id;
                }

                if(typeof vehicle.model != 'undefined'){
                    let dataModel = {
                        name: vehicle.model.trim()
                    };

                    if(typeof vehicle.maker_id != 'undefined'){
                        dataModel.maker_id = vehicle.maker_id;
                    }
                    else{
                        let maker = await riteWay.VehicleMaker.create({
                            'name': vehicle.maker.trim()
                        });
                        dataModel.maker_id = maker.id;
                    }                    

                    let model = await riteWay.VehicleModel.create(dataModel);
                    vehicle.model_id = model.id;
                }

                vehicle.quote_id = quote.id;

                let newVehicle = await riteWay.Vehicle.create(vehicle);
                vehicles.push(newVehicle);
                console.log(`vehicle created ${newVehicle.id}`);
            }


            if(rwData.order){
                originLocation = await riteWay.Location.create(rwData.originLocation);
                console.log(`originLocation created ${originLocation.id}`);
                originContactInfo = await riteWay.ContactInformation.create({
                    ...rwData.originLocation.contact_information, 
                    location_id: originLocation.id
                });

                destinationLocation = await riteWay.Location.create(rwData.destinationLocation);
                console.log(`destinationLocation created ${destinationLocation.id}`);
                destinationContactInfo = await riteWay.ContactInformation.create(
                    {
                        ...rwData.destinationLocation.contact_information, 
                        location_id: destinationLocation.id,

                    });

                
                order = await riteWay.Order.create({
                    ...rwData.order, 
                    quote_id: quote.id, 
                    user_accept_id: user.id,
                    location_destination_id: destinationLocation.id,
                    location_origin_id: originLocation.id,
                });
                console.log(`order created ${quote.id}`);

                if(rwData.carrier != null){

                    if(rwData.carrier.isNew){
                        carrier = await riteWay.Carrier.create(rwData.carrier);
                        console.log(`Carrier created ${carrier.id}`);
                    }
                    else{
                        carrier = rwData.carrier;
                    }

                    if(carrier.id){
                        driver = await riteWay.Driver.create({
                            ...rwData.carrier.driver,
                            order_id: order.id,
                            carrier_id: carrier.id
                        });
                        console.log(`Driver created ${carrier.id}`);
                    }
                }                
            }            
            
            quote = await riteWay.Quote.findByPk(quote.id, {
                include: this.quoteIncludeData
            });
            let status =  order ? order.status : quote.state;
            let watch = (status == 'cancelled' ? false : true);

            let stageQuoteData = {
                riteWayId: quote.id,
                fdOrderId: FDEntity.FDOrderID,
                fdAccountId: '',
                fdResponse: 'Imported',
                status: status,
                watch: watch
            };

            stageQuote = await StageQuote.create(stageQuoteData);
            return true;

        }
        catch(e){
            //console.log(`error on the process`, e);

            if(destinationContactInfo){
                await destinationContactInfo.destroy();
            }

            if(destinationLocation){
                await destinationLocation.destroy();
            }

            if(originContactInfo){
                await originContactInfo.destroy();
            }

            if(originLocation){
                await originLocation.destroy();
            }

            if(driver){
                await driver.destroy();
            }

            if(carrier){
                await carrier.destroy();
            }

            if(order){
                await order.destroy();
            }

            if(vehicles.length>0){
                vehicles.forEach(async v => {
                    await v.destroy();
                });
            }

            if(quote){
                await quote.destroy();
            }

            throw e;
        }     
    }
}

module.exports = RiteWayAutotranportService;