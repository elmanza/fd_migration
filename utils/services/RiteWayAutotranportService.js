const moment = require('moment');

const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;

const riteWay  = require("../../models/RiteWay/_riteWay");
const StageQuote = require('../../models/Stage/quote');
const OperatorUser = require('../../models/Stage/operator_user');

const {ritewayDB} = require('../../config/database');

const Crypter = require('../crypter');

const OrderResource = require('./http/resources/RiteWayAutotransport/OrderResource');
const InvoiceResource = require('./http/resources/RiteWayAutotransport/InvoiceResource');

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

        this.orderResource = new OrderResource();    
        this.invoiceResource = new InvoiceResource();    
    }

    _parseStatus(status){
        //let validStatus = ['active', 'onhold', 'cancelled', 'posted', 'notsigned', 'dispatched', 'issues', 'pickedup', 'delivered'];
        let validStatus = ['active', 'onhold', 'cancelled', 'posted', 'notsigned', 'dispatched', 'delivered', 'pickedup', 'delivered'];
        if(typeof validStatus[status-1] == 'undefined'){
            //revisar este estado.
            console.log("Status not valid "+status);
            return 'active';
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

    async processFDPayments(FDEntity, order = null, company = null){
        let result = {
            tariff: Number(FDEntity.tariff),
            totalPaid: 0,
            invoiceData: null,
            paymentsData: []
        };

        let lastPaymentDate = null;

        if(FDEntity.payments.length > 0){
            for(let i=0; i<FDEntity.payments.length; i++){
                let fdPayment = FDEntity.payments[i];
                let amount = Number(fdPayment.amount);
                
                let user = await riteWay.User.findOne({
                    where: Sequelize.where(
                        Sequelize.col('username'),
                        'ilike',
                        fdPayment.user.email.trim()
                    )
                });
                
                if(user == null){
                    let name = fdPayment.user.contactname.split(' ');
                    let userData = {
                        name: name[0],
                        last_name: name.slice(1).join(' '),
                        username: fdPayment.user.email,
                        photo: '',
                        phone: fdPayment.user.phone,
                        shipper_type: '',
                        is_company_admin: false,
                        isOperator: true,
                        company_id: null
                    };

                    if(company){
                        userData.company_id = company.id;
                    }

                    user = await this.createUser(userData, name[0]);
                    await OperatorUser.create({
                        riteWayId: user.id,
                        riteWayPass: name[0],
                        fdEmail: fdPayment.user.email,
                    });
                }

                if(fdPayment.from == 'Shipper' && fdPayment.to == "Company"){
                    result.totalPaid += amount;
                    if(lastPaymentDate == null){
                        lastPaymentDate = fdPayment.created;
                    }

                    if(moment(fdPayment.created).isAfter(lastPaymentDate)){
                        lastPaymentDate = fdPayment.created;
                    }
                }

                let paymentData = {
                    amount: amount,
                    transaction_id: fdPayment.transaction_id,
                    from: fdPayment.from,
                    to: fdPayment.to,
                    user_id: user.id,
                    createdAt: fdPayment.created,
                    updatedAt: fdPayment.created,
                };
                if(order){
                    paymentData.order_id = order.id;
                }

                result.paymentsData.push(paymentData);
            }
        }

        //Invoice.................
        if(this._parseStatus(FDEntity.status) == 'delivered'){
            result.invoiceData = {
                status: result.tariff > result.totalPaid ? 'pending' : 'paid',
                isPaid: !(result.tariff > result.totalPaid),
                paided_at: result.tariff > result.totalPaid  ? null : lastPaymentDate,
                createdAt: FDEntity.delivered||FDEntity.actual_pickup_date||FDEntity.avail_pickup_date||FDEntity.created,
                updatedAt: FDEntity.delivered||FDEntity.actual_pickup_date||FDEntity.avail_pickup_date||FDEntity.created,
                amount: result.tariff
            };
            if(order){
                result.invoiceData.order_id = order.id;
            }
        }

        return result;
    }

    async processFDNotes(FDEntity, quote){
        let usersList = {};
        let notes = [];
        for(let iN=0; iN < FDEntity.notes.length; iN++){
            let fdNote = FDEntity.notes[iN];
            let rwUser = null;
            
            if(typeof usersList[fdNote.email.trim()] == 'undefined'){
                let user = await riteWay.User.findOne({
                    where: {
                        username: fdNote.email
                    }
                });
                
                if(user){
                    usersList[user.username] = user;
                    rwUser = usersList[user.username];
                }
            }
            
            else{
                rwUser = usersList[fdNote.email];
            }
                
            if(rwUser != null){
                let noteData = {
                    userId: rwUser.id,
                    createdAt: fdNote.created,
                    updatedAt: fdNote.created,
                    showOnCustomerPortal:false,
                    text: fdNote.text
                };

                if(quote){
                    noteData.quoteId = quote.id;

                    let rwNote = await riteWay.Note.findOne({
                        where: {
                            [dbOp.and] : [
                                Sequelize.where(
                                    Sequelize.col('notes.quote_id'),
                                    '=',
                                    noteData.quoteId
                                ),
                                Sequelize.where(
                                    Sequelize.col('notes.user_id'),
                                    '=',
                                    noteData.userId
                                ),
                                Sequelize.where(
                                    Sequelize.col('notes.created_at'),
                                    '=',
                                    fdNote.created
                                )
                            ]
                        }
                    });   
                    if(rwNote == null){
                        notes.push(noteData);
                    }
                }
                else{
                    notes.push(noteData);
                }
            }
        }
        return notes;
    }

    async processFDCarrierDriver(FDEntity, order = null){
        let result = {
            carrier: null,
            driver: null
        };

        if(FDEntity.carrier){
            result.carrier = await riteWay.Carrier.findOne({
                where: {
                    insurance_iccmcnumber: FDEntity.carrier.insurance_iccmcnumber.trim()
                }
            });

            if(result.carrier == null){
                let city = await this.getRWCity(FDEntity.carrier.state, FDEntity.carrier.city);
    
                result.carrier = {
                    company_name: FDEntity.carrier.company_name.trim(),
                    email: FDEntity.carrier.email,
                    address: FDEntity.carrier.address1,
                    zip: FDEntity.carrier.zip_code,
                    insurance_iccmcnumber: FDEntity.carrier.insurance_iccmcnumber.trim()
                }
                
                if(city){
                    result.carrier.city_id = city.id;
                }
            }

            if(result.carrier){

                result.driver = {
                    name: '',
                    phone: ''
                };

                if(FDEntity.carrier.driver != null){
                    result.driver.name = FDEntity.carrier.driver.driver_name;
                    result.driver.phone = FDEntity.carrier.driver.driver_phone;
                    if(order){
                        result.driver.order_id = order.id;
                    }
                }                    
            }
        }

        return result;
    }

    getOriginDestinationLocations(FDEntity){
        let result = {
            originLocation: null,
            destinationLocation: null
        };

        let locationType = function(locationType){
            return locationType == 'Residential' ? 2 : 1;
        };
        
        result.originLocation = {
            address: FDEntity.origin.address1,
            company_name: FDEntity.origin.company,
            type_address_id: locationType(FDEntity.origin.location_type),
            pickup_time_start: FDEntity.origin.hours,
            pickup_time_end: FDEntity.origin.hours,
            contact_information: {
                name: FDEntity.origin.name,
                phone: FDEntity.origin.phone1,
                email: ''
            }
        };

        result.destinationLocation = {
            address: FDEntity.destination.address1,
            company_name: FDEntity.destination.company,
            type_address_id: locationType(FDEntity.destination.location_type),
            pickup_time_start: FDEntity.destination.hours,
            pickup_time_end: FDEntity.destination.hours,
            contact_information: {
                name: FDEntity.destination.name,
                phone: FDEntity.destination.phone1,
                email: ''
            }
        };

        return result;
    }

    getOrderData(FDEntity){
        return {
            status: this._parseStatus(FDEntity.status),
            createdAt:  FDEntity.ordered||FDEntity.created,
            updatedAt:  FDEntity.ordered||FDEntity.created,
            estimated_delivery_date: FDEntity.delivery_date || FDEntity.delivered,
            deliveredAt: FDEntity.delivered,
            pickedUpAt: FDEntity.actual_pickup_date || FDEntity.avail_pickup_date,
            deletedAt: FDEntity.archived
        };
    }

    async parseFDData(FDEntity, company = null){
        let rwData = {};

        //Quote Data ===================================================
        rwData.quantity = FDEntity.vehicles.length;
        rwData.estimated_ship_date = FDEntity.est_ship_date || FDEntity.avail_pickup_date;
        rwData.ship_via = (FDEntity.ship_via-1>0?FDEntity.ship_via-1:0);
        rwData.offered_at = FDEntity.ordered||FDEntity.created;
        rwData.created_at = FDEntity.created;
        rwData.updated_at = FDEntity.created;
        rwData.fd_id = FDEntity.id;
        rwData.fd_number = FDEntity.FDOrderID;
        rwData.tariff = Number(FDEntity.tariff);


        rwData.origin_zip = FDEntity.origin.zip || '';
        rwData.origin_address = FDEntity.origin.address1;
        let originCity = await this.getRWCity(FDEntity.origin.state, FDEntity.origin.city);
        rwData.originCity = originCity ? originCity.id : null;

        rwData.destination_zip = FDEntity.destination.zip || '';
        rwData.destination_address = FDEntity.destination.address1;
        let destinationCity = await this.getRWCity(FDEntity.destination.state, FDEntity.destination.city);
        rwData.destinationCity = destinationCity ? destinationCity.id : null;

        rwData.company = company;
        rwData.user = await riteWay.User.findOne({
            where: {
                username: FDEntity.shipper.email
            }
        });
        //user................
        if(rwData.user != null){
            if(rwData.user.company_id != null && rwData.user.company_id != '' && rwData.company == null){
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
                where: Sequelize.where(
                    Sequelize.col('username'),
                    'ilike',
                    FDEntity.assignedTo.email.trim()
                )
            });
            if(operator  == null){
                operator = await riteWay.User.findOne({
                    where: Sequelize.where(
                        Sequelize.col('username'),
                        'ilike',
                        'jeff@ritewayautotransport.com'
                    )
                });
            }

            rwData.company = {
                isNew: true,
                name: FDEntity.shipper.company.trim(),
                photo: '',
                email: FDEntity.shipper.email,
                phone: FDEntity.shipper.phone1,
                address: FDEntity.shipper.address1,
                operator_id: operator.id
            };
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
                carrierPay: Number(vehicle.carrier_pay),
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
            rwData.order = this.getOrderData(FDEntity);
            
            let {originLocation, destinationLocation} = this.getOriginDestinationLocations(FDEntity);
            
            rwData.originLocation = originLocation;
            rwData.destinationLocation = destinationLocation;

            //Carrier................
            let carrierDriverData = await this.processFDCarrierDriver(FDEntity);
            rwData.carrier = carrierDriverData.carrier;
            rwData.driver = carrierDriverData.driver;

            if(rwData.carrier != null){
                if(typeof rwData.carrier.id == 'undefined'){
                    rwData.carrier = {...rwData.carrier, isNew:true };
                }
            }
            
            //Payments and invoice
            let paymentsInvoiceData = await this.processFDPayments(FDEntity);

            //Payments...............
            rwData.payments = paymentsInvoiceData.paymentsData;

            //Invoice.................
            rwData.invoice = paymentsInvoiceData.invoiceData;
            //Notes.................
            rwData.notes = await this.processFDNotes(FDEntity);
        }
        return rwData;
    }


    async createUser(userData, plainPassoword){        
        let riteWayUser = await riteWay.User.findOne({
            where: {
                username: userData.username
            }
        });

        if(!riteWayUser){            
            let password = await Crypter.encryptPassword(plainPassoword);
            riteWayUser = await riteWay.User.create({
                ...userData,
                password: password
            });
        }

        return riteWayUser;
    }

    async importQuote(FDEntity, preCompany = null){
        let rwQuote = await riteWay.Quote.findOne({
            where: {
                fd_number: FDEntity.FDOrderID
            }
        });

        let stageQuote = await StageQuote.findOne({
            where: {
                fdOrderId: FDEntity.FDOrderID
            }
        });

        if(rwQuote != null && stageQuote == null){
            stageQuote = await StageQuote.create({
                riteWayId: rwQuote.id,
                fdOrderId: FDEntity.FDOrderID,
                fdAccountId: '',
                fdResponse: 'Imported',
                status: '',
                watch: true
            });
        }

        if(stageQuote != null || rwQuote != null){
            return false;
        }

        let rwData = await this.parseFDData(FDEntity, preCompany);

        let company = rwData.company;
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
        let payments = [];
        let invoice = null;
        let notes = [];

        try {
            if(company.isNew){
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
            stageQuote = await StageQuote.create({
                riteWayId: quote.id,
                fdOrderId: FDEntity.FDOrderID,
                fdAccountId: '',
                fdResponse: 'Imported',
                status: '',
                watch: false
            });
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
                    if(typeof carrier.id != 'undefined' && rwData.driver != null){
                        driver = await riteWay.Driver.create({
                            ...rwData.driver,
                            order_id: order.id,
                            carrier_id: carrier.id
                        });
                        console.log(`Driver created ${driver.id}`);
                    }
                }
                if(rwData.payments.length>0){
                    for(let i=0; i<rwData.payments.length; i++){
                        let payment = rwData.payments[i];
                        payment.order_id = order.id;
                        let newPayment = await riteWay.Payment.create(payment);
                        payments.push(newPayment);
                        console.log(`Payment created ${newPayment.id}`);
                    }
                }
                if(rwData.invoice){
                    invoice = await riteWay.Invoice.create({
                        ...rwData.invoice,
                        order_id : order.id
                    });
                    console.log(`Invoice created ${invoice.id}`);
                }  
                if(rwData.notes.length>0){
                    for(let i=0; i<rwData.notes.length; i++){
                        let note = rwData.notes[i];
                        let newNote = await riteWay.Note.create({
                            ...note, 
                            quoteId: quote.id
                        });
                        notes.push(newNote);
                        console.log(`Note created ${newNote.id}`);
                    }
                }              
            }            
            
            quote = await riteWay.Quote.findByPk(quote.id, {
                include: this.quoteIncludeData
            });
            let status =  order ? order.status : quote.state;
            let watch = (status == 'cancelled'? false : true);

            let stageQuoteData = {
                riteWayId: quote.id,
                fdOrderId: FDEntity.FDOrderID,
                fdAccountId: '',
                fdResponse: 'Imported',
                status: status,
                watch: watch
            };

            stageQuote.update(stageQuoteData);
            return true;

        }
        catch(e){
            console.log(`error on the process`, e);

            if(notes.length>0){
                for(let i=0; i<notes.length; i++){
                    let n = notes[0];
                    await n.destroy();
                }
            }

            if(payments.length>0){
                for(let i=0; i<payments.length; i++){
                    let p = payments[0];
                    await p.destroy();
                }
            }

            if(invoice){
                await invoice.destroy();
            }

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

            if(order){
                await order.destroy();
            }

            if(vehicles.length>0){
                for(let i=0; i<vehicles.length; i++){
                    let v = vehicles[0];
                    await v.destroy();
                }
            }

            if(quote){
                await quote.destroy();
            }

            throw e;
        }     
    }

    uploadDocument(orderId, fileData){
        this.orderResource.uploadDocument(orderId, fileData);
    }

    uploadInvoice(invoiceId, fileData){
        this.invoiceResource.uploadInvoiceFile(invoiceId, fileData);
    }
}

module.exports = RiteWayAutotranportService;