const Crypter = require('../../utils/crypter');
const {ritewayDB} = require('../../config/database');
const riteWay  = require("../../models/RiteWay/_riteWay");
const StageQuote = require('../../models/Stage/quote');
const StageOpUser = require('../../models/Stage/operator_user');

class RWSynchronizer {

    async _parseRWQuoteToFDEntity(rwQuote){
        let fdQuoteData = {
            //Consistencia dentro de la tabla entities=======================================
            //ExternalOrderID: rwQuote.id,
            //EntityFlag:2, // (1 = Fetch from FD entity | 2 = Fetch from External Entity | 3 = Fetch from OrderID
            AssignedTo:rwQuote.company.operatorUser.username,
            //ReferrerID: 18, //RiteWay Main WebSite 
            //Shipper Contact Information=================================
            ShippingEstDate: moment(rwQuote.estimated_ship_date).format('YYYY-MM-DD'),
            AvailPickupDate: moment(rwQuote.estimated_ship_date).format('YYYY-MM-DD'),
            ShippingShipVia: rwQuote.ship_via+1, // 1:Open 2:Closed 3: DriveAway
        
            ShipperFName: rwQuote.user.name,
            ShipperLName: rwQuote.user.last_name,
            ShipperEmail: rwQuote.user.username,
            AssignedID: 1, // (provided to you in this document)
            ShipperPhone1: rwQuote.company.phone, //(please provide the number in a string),
            ShipperCompany: rwQuote.company.name, // (mandatory only when shipper is commercial)
            ShipperType: "Commercial", // (Residential / Commercial)
            ShipperAddress1: rwQuote.company.address, 
            //Origin Posting Information ====================================
            OriginCity: rwQuote.originCity.name, //| Origin City name
            OriginState: rwQuote.originCity.state.abbreviation, // Origin State Name
            OriginCountry:"US",//| Origin Country Name
            OriginZip: (rwQuote.origin_zip == null ? rwQuote.originCity.zip : rwQuote.origin_zip ), //| Origin ZipCode
        
            //Destination Posting information================================
            DestinationCity: rwQuote.destinationCity.name, //| Destination City Name
            DestinationState: rwQuote.destinationCity.state.abbreviation, //| Destination State Name
            DestinationCountry:"US", //| Destination Country Name
            DestinationZip: (rwQuote.destination_zip == null ? rwQuote.destinationCity.zip : rwQuote.destination_zip ), //Destination ZipCode

            //Notifaction information
            send_email:0, //| 0: Dont send Email 1: Send email
            save_shipper:0, //0 or 1(when new shipper is added than mandatory 0 = false 1 = true)
            update_shipper:1,// 0 or 1 (when existing is getting updated than mandatory 0=false 1=true
        };
        let vehicleCount = 0;
        rwQuote.vehicles.forEach((vehicle, index) => {
            let dataVehicle = {};
            dataVehicle["year"+index] = vehicle.year;
            dataVehicle["make"+index] = vehicle.vehicle_model.vehicle_maker.name;
            dataVehicle["model"+index] = vehicle.vehicle_model.name;
            dataVehicle["type"+index] = vehicle.vehicle_type.name;
            dataVehicle["tariff"+index] = (vehicle.tariff == null? 0:vehicle.tariff);
            dataVehicle["deposit"+index] = (vehicle.deposit == null? 0:vehicle.deposit);
            dataVehicle["vin"+index] = (vehicle.vin == null? 0:vehicle.vin);
            dataVehicle["carrier_pay"+index] = (vehicle.carrierPay == null? 0:vehicle.carrierPay);

            vehicleCount++;

            Object.assign(fdQuoteData, dataVehicle);
        });
        fdQuoteData['VehicleCount'] = vehicleCount;

        if(rwQuote.order != null){
            if(rwQuote.order.destinationLocation != null && rwQuote.order.originLocation != null){                
                //Origen
                let origin = rwQuote.order.originLocation;
                let originData = {};
                originData['OriginAddress1'] = origin.address;
                originData['OriginContactName'] = origin.contact_information.name;
                originData['OriginCompanyName'] = origin.company_name;
                originData['OriginPhone1'] = origin.contact_information.phone;
                originData['OriginType'] = origin.type_address.name;

                //Origen
                let destination = rwQuote.order.destinationLocation;
                let destinationData = {};
                destinationData['DestinationAddress1'] = destination.address;
                destinationData['DestinationContactName'] = destination.contact_information.name;
                destinationData['DestinationCompanyName'] = destination.company_name;
                destinationData['DestinationPhone1'] = destination.contact_information.phone;
                destinationData['DestinationType'] = destination.type_address.name;

                try{
                    originData['OriginHours'] = origin.pickup_time_start +' to '+origin.pickup_time_end;
                    destinationData['DestinationHours'] = destination.pickup_time_start +' to '+destination.pickup_time_end;
                }
                catch(e){ }
                
                Object.assign(fdQuoteData, originData);
                Object.assign(fdQuoteData, destinationData);
            }
        }

        return fdQuoteData;
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

    async _parseFDEntityToRWQuote(fdEntity){

        let quoteData = {};

        let shipper = await riteWay.User.findOne({
            where: {
                username: fdEntity.shipper.email
            }
        });

        let originCity = await this.getRWCity(fdEntity.origin.state, fdEntity.origin.city);
        let destinationCity = await this.getRWCity(fdEntity.destination.state, fdEntity.destination.city);

        quoteData.company_id = shipper.company_id;
        quoteData.user_create_id = shipper.id;
        quoteData.estimated_ship_date = fdEntity.est_ship_date;
        quoteData.ship_via = fdEntity.ship_via-1;

        quoteData.origin_zip = fdEntity.origin.zip;
        quoteData.origin_city = originCity.id;

        quoteData.destination_zip = fdEntity.destination.zip;
        quoteData.destination_city = destinationCity.id;



    }

    async createOrUpdateRWUsers(fdOperator){
        let plainPassoword = Math.random().toString(36).slice(2); 
        let newRWUser = false;
        let riteWayOperator = await riteWay.User.findOne({
            where: {
                username:fdOperator.email
            }
        });

        if(!riteWayOperator){
                    
            let name = fdOperator.contactname.split(' ');
            let password = await Crypter.encryptPassword(plainPassoword);                    

            riteWayOperator = await riteWay.User.create({
                name: name[0],
                last_name: name.slice(1).join(' '),
                username: fdOperator.email,
                password: password,
                photo: '',
                phone: fdOperator.phone,
                shipper_type: '',
                is_company_admin: false,
                isOperator: true,
                company_id: null
            });  

            newRWUser = true;
        }

        let stOperatorUser = await  StageOpUser.findOne({
            where: {
                fdEmail: fdOperator.email
            }
        });
        
        if(!stOperatorUser){
            stOperatorUser = await  StageOpUser.create({
                riteWayId: riteWayOperator.id,
                riteWayPass: newRWUser ? plainPassoword : "",
                fdId: fdOperator.id,
                fdUsername: fdOperator.username,
                fdEmail: fdOperator.email,
            });
        }
        else{
            stOperatorUser = await stOperatorUser.update({
                riteWayId: riteWayOperator.id,
                fdId: fdOperator.id,
                fdUsername: fdOperator.username,
            });
        }
    }

    async createOrUpdateRWQuote(fdEntity){
        let pRWData = await this._parseFDEntityToRWQuote(fdEntity);  
    }
}