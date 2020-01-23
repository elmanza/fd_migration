
require('dotenv').config();

const moment = require('moment');
const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;
const QuoteResource = require("../../services/FreightDragon/resources/quote");

const riteWay  = require("../../models/RiteWay/_riteWay");


const StageQuote = require('../../models/Stage/quote');

class FreighDragonOrderTask{
    constructor(){
        this.quoteResource = new QuoteResource(process.env.QUOTE_API_USER, process.env.QUOTE_API_CODE);
        this.finishedProcess = {
            createQuotes:true,
            refreshQuotes:true,
            quotesToOrders:true,
        };

        this.allIncludeData = [
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
                    attributes: ['name', 'last_name', 'username', 'last_name'],
                }]
            },
            {
                model: riteWay.User,
                require: true,
                attributes: ['name', 'last_name', 'username', 'last_name'],
                include: [riteWay.Company]
            },
            {
                model:riteWay.City,
                require:true,
                as: 'originCity',
                attributes: ['name', 'zip'],
                include: [
                    {
                        model: riteWay.State,
                        attributes: ['abbreviation']
                    }
                ]
            },
            {
                model:riteWay.City,
                require:true,
                as: 'destinationCity',
                attributes: ['name', 'zip'],
                include: [
                    {
                        model: riteWay.State,
                        attributes: ['abbreviation']
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

    _parseDataQuoute(riteWayQuote){
        let fdQuoteData = {
            //Consistencia dentro de la tabla entities=======================================
            ExternalOrderID: riteWayQuote.id,
            EntityFlag:2, // (1 = Fetch from FD entity | 2 = Fetch from External Entity | 3 = Fetch from OrderID
            AssignedTo:riteWayQuote.company.operatorUser.username,
            ReferrerID: 18, //RiteWay Main WebSite 
            //Shipper Contact Information=================================
            shipping_est_date: moment(riteWayQuote.estimated_ship_date).format('YYYY-MM-DD'),
            AvailPickupDate: moment(riteWayQuote.estimated_ship_date).format('YYYY-MM-DD'),
            ShippingShipVia: riteWayQuote.ship_via+1, // 1:Open 2:Closed 3: DriveAway
        
            ShipperFName: riteWayQuote.user.name,
            ShipperLName: riteWayQuote.user.last_name,
            ShipperEmail: riteWayQuote.user.username,
            AssignedID: 1, // (provided to you in this document)
            ShipperPhone1: riteWayQuote.company.phone, //(please provide the number in a string),
            ShipperCompany: riteWayQuote.company.name, // (mandatory only when shipper is commercial)
            ShipperType: "Commercial", // (Residential / Commercial)
            ShipperAddress1: riteWayQuote.company.address, 
            //Origin Posting Information ====================================
            OriginCity: riteWayQuote.originCity.name, //| Origin City name
            OriginState: riteWayQuote.originCity.state.abbreviation, // Origin State Name
            OriginCountry:"US",//| Origin Country Name
            OriginZip: (riteWayQuote.origin_zip == null ? riteWayQuote.originCity.zip : riteWayQuote.origin_zip ), //| Origin ZipCode
        
            //Destination Posting information================================
            DestinationCity: riteWayQuote.destinationCity.name, //| Destination City Name
            DestinationState: riteWayQuote.destinationCity.state.abbreviation, //| Destination State Name
            DestinationCountry:"US", //| Destination Country Name
            DestinationZip: (riteWayQuote.destination_zip == null ? riteWayQuote.destinationCity.zip : riteWayQuote.destination_zip ), //Destination ZipCode

            //Notifaction information
            send_email:0, //| 0: Dont send Email 1: Send email
            save_shipper:0, //0 or 1(when new shipper is added than mandatory 0 = false 1 = true)
            update_shipper:1,// 0 or 1 (when existing is getting updated than mandatory 0=false 1=true
        };
        let vehicleCount = 0;
        riteWayQuote.vehicles.forEach((vehicle, index) => {
            let dataVehicle = {};
            dataVehicle["year"+index] = vehicle.year;
            dataVehicle["make"+index] = vehicle.vehicle_model.vehicle_maker.name;
            dataVehicle["model"+index] = vehicle.vehicle_model.name;
            dataVehicle["type"+index] = vehicle.vehicle_type.name;
            dataVehicle["tariff"+index] = (vehicle.tariff == null? 0:vehicle.tariff);
            dataVehicle["deposit"+index] = (vehicle.deposit == null? 0:vehicle.deposit);
            dataVehicle["carrier_pay"+index] = (vehicle.carrierPay == null? 0:vehicle.carrierPay);
            vehicleCount++;

            Object.assign(fdQuoteData, dataVehicle);
        });
        fdQuoteData['VehicleCount'] = vehicleCount;

        if(riteWayQuote.order != null){
            if(riteWayQuote.order.destinationLocation != null && riteWayQuote.order.originLocation != null){                
                //Origen
                let origin = riteWayQuote.order.originLocation;
                let originData = {};
                originData['OriginAddress1'] = origin.address;
                originData['OriginContactName'] = origin.contact_information.name;
                originData['OriginCompanyName'] = origin.company_name;
                originData['OriginPhone1'] = origin.contact_information.phone;
                originData['OriginType'] = origin.type_address.name;

                //Origen
                let destination = riteWayQuote.order.destinationLocation;
                let destinationData = {};
                destinationData['DestinationAddress1'] = destination.address;
                destinationData['DestinationContactName'] = destination.contact_information.name;
                destinationData['DestinationCompanyName'] = destination.company_name;
                destinationData['DestinationPhone1'] = destination.contact_information.phone;
                destinationData['DestinationType'] = destination.type_address.name;

                try{
                    originData['OriginHours'] = moment(origin.pickup_time_start).format('HH:mm:ss') +' to '+moment(origin.pickup_time_end).format('HH:mm:ss');
                    destinationData['DestinationHours'] = moment(destination.pickup_time_start).format('HH:mm:ss') +' to '+moment(destination.pickup_time_end).format('HH:mm:ss');
                }
                catch(e){ }
                
                Object.assign(fdQuoteData, originData);
                Object.assign(fdQuoteData, destinationData);
            }
        }

        return fdQuoteData;
    }

    async sendCreateRequestToFD(riteWayQuote){
        let stageQuote = null;
        try{
            let fdQuoteData = this._parseDataQuoute(riteWayQuote);
            let res = await this.quoteResource.create(fdQuoteData);            
            if(!res.Success){
                fdQuoteData.save_shipper = 1;
                fdQuoteData.update_shipper = 0;
                res = await this.quoteResource.create(fdQuoteData);
            }

            if(res.Success){
                let stageQuoteData = {
                    riteWayId: riteWayQuote.id,
                    fdOrderId: res.EntityID,
                    fdAccountId: res.AccountID,
                    fdResponse: JSON.stringify(res),
                    status: "waiting"
                };

                stageQuote = await StageQuote.create(stageQuoteData);
            }
            else{
                let stageQuoteData = {
                    riteWayId: riteWayQuote.id,
                    status: "fd_quote_creation_error",
                    fdResponse: JSON.stringify(res)
                };

                stageQuote = await StageQuote.create(stageQuoteData);
            }
            
        }
        catch(e){
            throw e;
        }  
        
        return (stageQuote == null? null: "Quote created. quote_id: "+stageQuote.riteWayId+ " company: "+riteWayQuote.company.name + " fd_order_id: "+stageQuote.fdOrderId);
    }

    async sendGetRequestToFD(stageQuote){
            let riteWayQuote = await riteWay.Quote.findByPk(stageQuote.riteWayId, {
                include: this.allIncludeData,
                paranoid: false
            });
            //Update quote with all data
            let fdQuoteData = this._parseDataQuoute(riteWayQuote);
            fdQuoteData.FDOrderID = riteWayQuote.stage_quote.fdOrderId;

            let res = await this.quoteResource.update(fdQuoteData);
            //-------------------------------------
            res = await this.quoteResource.get({
                FDOrderID: stageQuote.fdOrderId
            });

            if(res.Success){
                let fdQuote = res.Data;
                if(fdQuote.tariff > 0){   

                    for(let j=0; j<riteWayQuote.vehicles.length; j++){
                        let rwVehicle = riteWayQuote.vehicles[j];

                        for(let k=0; k<fdQuote.vehicles.length; k++){
                            let fdVehicle = fdQuote.vehicles[k];
                            
                            if(rwVehicle.vin ==  fdVehicle.vin){
                                await rwVehicle.update({
                                    tariff: fdVehicle.tariff,
                                    deposit: fdVehicle.deposit,
                                    carrierPay: fdVehicle.carrier_pay,
                                });
                            }
                        }
                    }

                    await riteWayQuote.update({
                        state: 'offered',
                        tariff: fdQuote.tariff
                    });
    
                    stageQuote = await riteWayQuote.stage_quote.update({
                        status: 'offered',
                        fdResponse: "fd_get_quote_sucess"
                    }); 
                }

                return "quote_id: "+riteWayQuote.id+ " company: "+riteWayQuote.company.name;
            }
            else{
                await riteWayQuote.stage_quote.update({
                    status: "fd_get_quote_error",
                    fdResponse: JSON.stringify(res)
                });
                return "fd_get_quote_error quote_id: "+riteWayQuote.id+ " company: "+riteWayQuote.company.name;
            }
    }

    async sendQuoteToOrderRequestToFD(riteWayQuote){

        //Update quote with all data
        let fdQuoteData = this._parseDataQuoute(riteWayQuote);
        fdQuoteData.FDOrderID = riteWayQuote.stage_quote.fdOrderId;

        let res = await this.quoteResource.update(fdQuoteData);      
    
        res = await this.quoteResource.toOrder({
            FDOrderID: riteWayQuote.stage_quote.fdOrderId,
        });
        
        if(res.Success){
            await riteWayQuote.stage_quote.update({
                status: 'accepted',
                fdOrderId: res.EntityID,
                fdResponse: JSON.stringify(res)
            });
        }
        else{
            await riteWayQuote.stage_quote.update({
                status: "fd_order_creation_error",
                fdResponse: JSON.stringify(res)
            });
        }

        return (res.Success? "Order created. quote_id: "+riteWayQuote + " company: "+riteWayQuote.company.name : "fd_order_creation_error");
    }

    createQuotes(){
        if(!this.finishedProcess.createQuotes){
            return null;
        }
        let recProccesed = 0;
        this.finishedProcess.createQuotes = false;

        riteWay.Quote.findAll({
            include: this.allIncludeData,
            where: {
                [dbOp.and] : [
                    Sequelize.where(
                        Sequelize.col('company.operatorUser.id'),
                        'IS NOT',
                        null
                    ),
                    Sequelize.where(
                        Sequelize.col('order.id'),
                        'IS',
                        null
                    ),
                    Sequelize.where(
                        Sequelize.col('quotes.state'),
                        '=',
                        'waiting'
                    ), 
                    Sequelize.where(
                        Sequelize.col('stage_quote.id'),
                        'IS',
                        null
                    ),
                ]
            }
        })
        .then(quotes => {
            if(quotes.length == 0){
                this.finishedProcess.createQuotes = true;
            }
            quotes.forEach(quote => {   
                recProccesed++;              
                this.sendCreateRequestToFD(quote)
                .then(result => {
                    console.log("createQuotes ", result);
                    console.log();
                })
                .catch(error => {
                    console.log("createQuotes Error ", error);
                })
                .finally(()=>{
                    recProccesed--;
                    if(recProccesed<=0){
                        this.finishedProcess.createQuotes = true;
                    }
                });
            });
        });
    }

    refreshQuotes(){
        if(!this.finishedProcess.refreshQuotes){
            return null;
        }
        
        this.finishedProcess.refreshQuotes = false;
        let recProccesed = 0;
        StageQuote.findAll({
            where: {
                'status': 'waiting',
                'watch': true,
                'fdOrderId': {
                    [dbOp.not]: null
                }
            }
        })
        .then( stageQuotes => {
            if(stageQuotes.length == 0){
                this.finishedProcess.refreshQuotes = true;
            }
            stageQuotes.forEach(stageQuote => {
                recProccesed++;
                this.sendGetRequestToFD(stageQuote)
                .then(result => {
                    console.log("refreshQuotes ", result);
                })
                .catch(error => {
                    console.log("refreshQuotes Error ", error);
                })
                .finally(()=>{
                    recProccesed--;
                    if(recProccesed <= 0){
                        this.finishedProcess.refreshQuotes = true;
                    }                    
                });
            });
        });
    }

    quotesToOrders(){
        if(!this.finishedProcess.quotesToOrders){
            return null;
        }
        let recProccesed = 0;
        this.finishedProcess.quotesToOrders = false;

        riteWay.Quote.findAll({
            include: this.allIncludeData,
            where: {
                [dbOp.and] : [
                    Sequelize.where(
                        Sequelize.col('order.id'),
                        'IS NOT',
                        null
                    ),
                    Sequelize.where(
                        Sequelize.col('quotes.state'),
                        '=',
                        'accepted'
                    ), 
                    Sequelize.where(
                        Sequelize.col('stage_quote.status'),
                        '=',
                        'offered'
                    ),
                    Sequelize.where(
                        Sequelize.col('stage_quote.watch'),
                        '=',
                        true
                    ),
                ]
            }
        })
        .then(quotes => {
            if(quotes.length == 0){
                this.finishedProcess.quotesToOrders = true;
            }
            quotes.forEach(quote => {        
                recProccesed++;         
                this.sendQuoteToOrderRequestToFD(quote)
                .then(res => {
                    console.log("quotesToOrders", res);
                })
                .catch(error => {
                    console.log("quotesToOrders Error", error);
                })
                .finally(()=>{
                    recProccesed--;
                    if(recProccesed <= 0){
                        this.finishedProcess.quotesToOrders = true;
                    }                    
                });
            });
        });
    }
}

module.exports = FreighDragonOrderTask;