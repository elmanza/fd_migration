
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
            ShippingShipVia: riteWayQuote.ship_via, // 1:Open 2:Closed 3: DriveAway
        
            ShipperFName: riteWayQuote.user.name,
            ShipperLName: riteWayQuote.user.last_name,
            ShipperEmail: riteWayQuote.user.username,
            AssignedID: 1, // (provided to you in this document)
            ShipperPhone1: riteWayQuote.user.company.phone, //(please provide the number in a string),
            ShipperCompany: riteWayQuote.user.company.name, // (mandatory only when shipper is commercial)
            ShipperType: "Commercial", // (Residential / Commercial)
            ShipperAddress1: riteWayQuote.user.company.address, 
            //Origin Posting Information ====================================
            OriginCity: riteWayQuote.originCity.name, //| Origin City name
            OriginState: riteWayQuote.originCity.state.abbreviation, // Origin State Name
            OriginCountry:"US",//| Origin Country Name
            OriginZip: (riteWayQuote.origin_zip == null ? riteWayQuote.originCity.zip : riteWayQuote.origin_zip ), //| Origin ZipCode
        
            //Destination Posting information================================
            DestinationCity: riteWayQuote.destinationCity.name, //| Destination City Name
            DestinationState: riteWayQuote.destinationCity.state.abbreviation, //| Destination State Name
            DestinationCountry:"US", //| Destination Country Name
            destination_zip: (riteWayQuote.destination_zip == null ? riteWayQuote.destinationCity.zip : riteWayQuote.destination_zip ), //Destination ZipCode

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
            dataVehicle["tariff"+index] = 0;
            dataVehicle["deposit"+index] = 0;
            dataVehicle["carrier_pay"+index] = 0;
            vehicleCount++;

            Object.assign(fdQuoteData, dataVehicle);
        });
        fdQuoteData['vehicleCount'] = vehicleCount;
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
        
        return (stageQuote == null? null: stageQuote.dataValues);
    }

    async sendGetRequestToFD(stageQuotes){
        let sQuotes = [];


        for(let i = 0; i<stageQuotes.length; i++){
            const stageQuote = stageQuotes[i];

            let res = await this.quoteResource.get({
                FDOrderID: stageQuote.fdOrderId
            });

            let riteWayQuote = await riteWay.Quote.findOne({
                include: [
                    {
                        model: StageQuote,
                        as:'stage_quote'
                    },
                    {
                        model: riteWay.Order
                    }
                ],
                where: {
                    id: stageQuote.riteWayId
                },
                paranoid: false
            });

            if(res.Success){
                let fdQuote = res.Data;
                if(fdQuote.tariff > 0){   
                    await riteWayQuote.update({
                        state: 'offered',
                        tariff: fdQuote.tariff
                    });
    
                    stageQuote = await riteWayQuote.stage_quote.update({
                        status: 'offered',
                        fdResponse: "fd_get_quote_sucess"
                    });  
                        
                    sQuotes.push(stageQuote.dataValues);
                }
            }
            else{
                await riteWayQuote.stage_quote.update({
                    status: "fd_get_quote_error",
                    fdResponse: JSON.stringify(res)
                });
            }
        }

        return sQuotes;
    }

    async sendQuoteToOrderRequestToFD(riteWayQuote){
        let res = await this.quoteResource.toOrder({
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

        return res;
    }

    createQuotes(){
        if(!this.finishedProcess.createQuotes){
            return null;
        }
        
        this.finishedProcess.createQuotes = false;

        riteWay.Quote.findAll({
            include: [
                {
                    model: riteWay.Order,
                    require: false,
                    attributes: []
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
                    as: 'stage_quote',
                    attributes:[]
                }
            ],
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
            quotes.forEach(quote => {                 
                this.sendCreateRequestToFD(quote)
                .then(result => {
                    console.log("createQuotes");
                    console.log(result);
                })
                .catch(error => {
                    console.log("createQuotes Error");
                    console.log(error);
                })
                .finally(()=>{
                    this.finishedProcess.createQuotes = true;
                });
            });
        });
    }

    refreshQuotes(){
        if(!this.finishedProcess.refreshQuotes){
            return null;
        }
        
        this.finishedProcess.refreshQuotes = false;

        StageQuote.findAll({
            where: {
                'status': 'waiting',
                'watch': true
            }
        })
        .then( stageQuotes => {
            this.sendGetRequestToFD(stageQuotes)
            .then(result => {
                console.log("refreshQuotes");
                console.log(result);
            })
            .catch(error => {
                console.log("refreshQuotes Error");
                console.log(error);
            })
            .finally(()=>{
                this.finishedProcess.refreshQuotes = true;
            });
        });
    }

    quotesToOrders(){
        if(!this.finishedProcess.quotesToOrders){
            return null;
        }
        
        this.finishedProcess.quotesToOrders = false;

        riteWay.Quote.findAll({
            include: [
                {
                    model: riteWay.Order,
                    require: true,
                    attributes: []
                },
                {
                    model:StageQuote,
                    as: 'stage_quote',
                    require: true,
                }
            ],
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
            quotes.forEach(quote => {                 
                this.sendQuoteToOrderRequestToFD(quote)
                .then(res => {
                    console.log("quotesToOrders");
                    console.log(res);
                })
                .catch(error => {
                    console.log("quotesToOrders Error");
                    console.log(error);
                })
                .finally(()=>{
                    this.finishedProcess.quotesToOrders = true;
                });
            });
        });
    }
}

module.exports = FreighDragonOrderTask;