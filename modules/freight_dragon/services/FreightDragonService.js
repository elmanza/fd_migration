const moment = require('moment');
const { MemberResource, EntityResource } = require('./http/resources');

const { FDConf, RWAConf, Storage } = require('../../../config');

const { QUOTE_STATUS, ORDER_STATUS, FD_STATUS } = require('../../../utils/constants');

class FreightDragonService {
    constructor() {
        this.memberResource = new MemberResource();
        this.entityResource = new EntityResource();
    }

    _parseStatus(RWStatus) {
        let validStatus = {
            [QUOTE_STATUS.WAITING]: FD_STATUS.LEAD,
            [QUOTE_STATUS.OFFERED]: FD_STATUS.LEAD,
            [QUOTE_STATUS.ORDERED]: FD_STATUS.ACTIVE,
            [ORDER_STATUS.ACTIVE]: FD_STATUS.ACTIVE,
            [ORDER_STATUS.POSTED]: FD_STATUS.POSTED,
            [ORDER_STATUS.NOTSIGNED]: FD_STATUS.NOTSIGNED,
            [ORDER_STATUS.SIGNED]: FD_STATUS.NOTSIGNED,
            [ORDER_STATUS.PICKEDUP]: FD_STATUS.PICKEDUP,
            [ORDER_STATUS.DISPATCHED]: FD_STATUS.DISPATCHED,
            [ORDER_STATUS.INTRANSIT_ONTIME]: FD_STATUS.PICKEDUP,
            [ORDER_STATUS.INTRANSIT_DELAY]: FD_STATUS.PICKEDUP,
            [ORDER_STATUS.DELIVERED]: FD_STATUS.DELIVERED,
            [ORDER_STATUS.DAMAGE]: FD_STATUS.DELIVERED,
            [ORDER_STATUS.CANCELLED]: FD_STATUS.CANCELLED,
        }
        
        return validStatus[RWStatus] || 1;
    }

    parseRWData(riteWayQuote) {
        let fdQuoteData = {
            //Consistencia dentro de la tabla entities=======================================
            //ExternalOrderID: riteWayQuote.id,
            //EntityFlag:2, // (1 = Fetch from FD entity | 2 = Fetch from External Entity | 3 = Fetch from OrderID
            AssignedTo: riteWayQuote.Company.customerDetail.operatorUser.username,
            //ReferrerID: 18, //RiteWay Main WebSite 
            //Shipper Contact Information=================================
            ShippingEstDate: moment(riteWayQuote.estimated_ship_date).format('YYYY-MM-DD'),
            AvailPickupDate: moment(riteWayQuote.estimated_ship_date).format('YYYY-MM-DD'),
            ShippingShipVia: riteWayQuote.ship_via + 1, // 1:Open 2:Closed 3: DriveAway

            ShipperFName: riteWayQuote.userCreate.name,
            ShipperLName: riteWayQuote.userCreate.last_name,
            ShipperEmail: riteWayQuote.userCreate.username,
            AssignedID: 1, // (provided to you in this document)
            ShipperPhone1: riteWayQuote.Company.phone, //(please provide the number in a string),
            ShipperCompany: riteWayQuote.Company.name, // (mandatory only when shipper is commercial)
            ShipperType: "Commercial", // (Residential / Commercial)
            ShipperAddress1: riteWayQuote.Company.address,
            //Origin Posting Information ====================================
            OriginCity: riteWayQuote.originCityInfo.name, //| Origin City name
            OriginState: riteWayQuote.originCityInfo.stateInfo.abbreviation, // Origin State Name
            OriginCountry: "US",//| Origin Country Name
            OriginZip: riteWayQuote.origin_zip || riteWayQuote.originCity.zip, //| Origin ZipCode

            //Destination Posting information================================
            DestinationCity: riteWayQuote.destinationCityInfo.name, //| Destination City Name
            DestinationState: riteWayQuote.destinationCityInfo.stateInfo.abbreviation, //| Destination State Name
            DestinationCountry: "US", //| Destination Country Name
            DestinationZip: riteWayQuote.destination_zip || riteWayQuote.destinationCity.zip, //Destination ZipCode

            //Notifaction information
            send_email: 0, //| 0: Dont send Email 1: Send email
            save_shipper: 0, //0 or 1(when new shipper is added than mandatory 0 = false 1 = true)
            update_shipper: 1,// 0 or 1 (when existing is getting updated than mandatory 0=false 1=true

            NotesFromShipper: riteWayQuote.special_instruction || '',
        };
        let vehicleCount = 0;
        riteWayQuote.vehiclesInfo.forEach((vehicle, index) => {
            let dataVehicle = {};
            dataVehicle["year" + index] = vehicle.year;
            dataVehicle["make" + index] = vehicle.VehicleModel.VehicleMaker.name;
            dataVehicle["model" + index] = vehicle.VehicleModel.name;
            dataVehicle["type" + index] = vehicle.VehicleType.name;
            dataVehicle["tariff" + index] = vehicle.tariff || 0;
            dataVehicle["deposit" + index] = vehicle.deposit || 0;
            dataVehicle["vin" + index] = vehicle.vin || 0;
            dataVehicle["carrier_pay" + index] = vehicle.carrierPay || 0;

            vehicleCount++;

            Object.assign(fdQuoteData, dataVehicle);
        });
        fdQuoteData['VehicleCount'] = vehicleCount;

        if (riteWayQuote.orderInfo) {
            fdQuoteData['Status'] = this._parseStatus(riteWayQuote.orderInfo.status_id);
            if (riteWayQuote.orderInfo.orderDesInfo != null && riteWayQuote.orderInfo.orderOriInfo != null) {
                //Origen
                let origin = riteWayQuote.orderInfo.orderOriInfo;
                let originData = {};
                originData['OriginAddress1'] = origin.address;
                originData['OriginContactName'] = origin.ContactInformation.name;
                originData['OriginCompanyName'] = origin.company_name;
                originData['OriginPhone1'] = origin.ContactInformation.phone;
                originData['OriginType'] = origin.addressTypeInfo.name;

                //Origen
                let destination = riteWayQuote.orderInfo.orderDesInfo;
                let destinationData = {};
                destinationData['DestinationAddress1'] = destination.address;
                destinationData['DestinationContactName'] = destination.ContactInformation.name;
                destinationData['DestinationCompanyName'] = destination.company_name;
                destinationData['DestinationPhone1'] = destination.ContactInformation.phone;
                destinationData['DestinationType'] = destination.addressTypeInfo.name;

                try {
                    originData['OriginHours'] = origin.pickup_time_start != origin.pickup_time_end ? origin.pickup_time_start + ' to ' + origin.pickup_time_end : origin.pickup_time_start;
                    destinationData['DestinationHours'] = destination.pickup_time_start != destination.pickup_time_end ? destination.pickup_time_start + ' to ' + destination.pickup_time_end : destination.pickup_time_start;
                }
                catch (e) { }

                Object.assign(fdQuoteData, originData);
                Object.assign(fdQuoteData, destinationData);
            }
        }

        return fdQuoteData;
    }

    async createQuote(riteWayQuote) {
        let fdEntityD = this.parseRWData(riteWayQuote);
        let res = await this.entityResource.createQuote(fdEntityD);

        if (!res.Success) {
            fdEntityD.save_shipper = 1;
            fdEntityD.update_shipper = 0;
            res = await this.entityResource.createQuote(fdEntityD);
        }

        return res;
    }

    quoteToOrder(FDOrderID) {
        return this.entityResource.quoteToOrder({ FDOrderID });
    }

    update(FDOrderID, riteWayQuote) {
        let fdEntityD = this.parseRWData(riteWayQuote);
        return this.entityResource.update({ FDOrderID, ...fdEntityD });
    }

    get(FDOrderID, recreateInvoice = false) {
        return this.entityResource.get({ FDOrderID, recreateInvoice });
    }

    getBatch(FDOrderID, recreateInvoice = false) {
        return this.entityResource.getBatch({ FDOrderID, recreateInvoice });
    }

    getList(iniDate, endDate, companyName) {
        return this.entityResource.getList({
            Created: `${iniDate}|${endDate}`,
            Company: companyName
        });
    }

    sendNotes(data) {
        return this.entityResource.sendNotes(data);
    }

    getMember(email) {
        return this.memberResource.get(email);
    }

    getMemberList() {
        return this.memberResource.getList();
    }

    sendFile(FDOrderID, file) {
        return this.entityResource.uploadDocument(FDOrderID, file);
    }

}

module.exports = FreightDragonService;