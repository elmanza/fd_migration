
require('dotenv').config();

const moment = require('moment');
const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;
const QuoteResource = require("../../services/FreightDragon/resources/quote");

const riteWay  = require("../../models/RiteWay/_riteWay");


const StageQuote = require('../../models/Stage/quote');

class FreighDragonOrderTask{
    constructor(){
        this.quoteResource = new QuoteResource(process.env.ORDER_API_USER, process.env.ORDER_API_CODE);
    }

    _parseDataQuoute(riteWayQuote){
        let fdQuoteData = {
            //Consistencia dentro de la tabla entities=======================================
            ExternalOrderID: riteWayQuote.id,
            EntityFlag:2, // (1 = Fetch from FD entity | 2 = Fetch from External Entity | 3 = Fetch from OrderID
            AssignedID:1,
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
            ShipperType: "Comercial", // (Residential / Commercial)
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

    createQuotes(){
        console.log("createQuotes");
        riteWay.Quote.findAll({
            include: [
                {
                    model: riteWay.Order,
                    require: false,
                    attributes: []
                },
                {
                    model: riteWay.User,
                    require: true,
                    include: [riteWay.Company]
                },
                {
                    model:riteWay.City,
                    require:true,
                    as: 'originCity',
                    include: [riteWay.State]
                },
                {
                    model:riteWay.City,
                    require:true,
                    as: 'destinationCity',
                    include: [riteWay.State]
                },
                {
                    model: riteWay.Vehicle,
                    as: 'vehicles',
                    require: true,
                    include: [
                        {
                            model: riteWay.VehicleModel,
                            include: [riteWay.VehicleMaker],
                            require:true
                        },
                        riteWay.VehicleType
                    ]
                }
            ],
            where: {
                [dbOp.and] : [
                    Sequelize.where(
                        Sequelize.col('orders.id'),
                        'IS',
                        null
                    ),
                    Sequelize.where(
                        Sequelize.col('quotes.state'),
                        '=',
                        'waiting'
                    )
                ]
            }
        })
        .then(quotes => {
            quotes.forEach(quote => {
                let fdQuoteData = this._parseDataQuoute(quote);    
                this.quoteResource.create(fdQuoteData)
                .then(res => {
                    console.log(res);
                })
                .catch(error => {
                    console.log(error);
                });
            });
        });
    }

    refreshQuotes(){

    }
}

module.exports = FreighDragonOrderTask;