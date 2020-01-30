const moment = require('moment');
const MemberResource = require('./http/resources/MemberResource');
const EntityResource = require('./http/resources/EntityResource');

class FreightDragonService{
    constructor(){
        this.memberResource = new MemberResource();
        this.entityResource = new EntityResource();
    }

    _parseStatus(RWStatus){
        let validStatus = ['active', 'onhold', 'cancelled', 'posted', 'notsigned', 'dispatched', 'issues', 'pickedup', 'delivered'];
        let fdStatus = validStatus.indexOf(RWStatus);
        if(fdStatus<0){
            return 1;
        }
        return fdStatus + 1;
    }

    parseRWData(riteWayQuote){
        let fdQuoteData = {
            //Consistencia dentro de la tabla entities=======================================
            //ExternalOrderID: riteWayQuote.id,
            //EntityFlag:2, // (1 = Fetch from FD entity | 2 = Fetch from External Entity | 3 = Fetch from OrderID
            AssignedTo:riteWayQuote.company.operatorUser.username,
            //ReferrerID: 18, //RiteWay Main WebSite 
            //Shipper Contact Information=================================
            ShippingEstDate: moment(riteWayQuote.estimated_ship_date).format('YYYY-MM-DD'),
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
            dataVehicle["vin"+index] = (vehicle.vin == null? 0:vehicle.vin);
            dataVehicle["carrier_pay"+index] = (vehicle.carrierPay == null? 0:vehicle.carrierPay);

            vehicleCount++;

            Object.assign(fdQuoteData, dataVehicle);
        });
        fdQuoteData['VehicleCount'] = vehicleCount;

        if(riteWayQuote.order != null){
            fdQuoteData['Status'] = this._parseStatus(riteWayQuote.order.status);
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

    async createQuote(riteWayQuote){   
        let fdEntityD = this.parseRWData(riteWayQuote);
        let res = await this.entityResource.createQuote(fdEntityD);

        if(!res.Success){
            fdEntityD.save_shipper = 1;
            fdEntityD.update_shipper = 0;
            res = await this.entityResource.createQuote(fdEntityD);
        }

        return res;
    }

    quoteToOrder(FDOrderID){
        console.log(FDOrderID);
        return this.entityResource.quoteToOrder({FDOrderID});
    }

    update(FDOrderID, riteWayQuote){
        let fdEntityD = this.parseRWData(riteWayQuote);
        //return this.entityResource.update({FDOrderID, ...fdEntityD});
        return this.entityResource.get({FDOrderID});
    }

    get(FDOrderID){
        return this.entityResource.get({FDOrderID});
    }

    getList(iniDate, endDate, companyName){
        return this.entityResource.getList({
            Created:`${iniDate}|${endDate}`,
            Company: companyName
        });
    }

    sendNotes(data){
        return this.entityResource.sendNotes(data);
    }

    getMember(email){
        return this.memberResource.get(email);
    }

    getMemberList(){
        return this.memberResource.getList();
    }

}

module.exports = FreightDragonService;