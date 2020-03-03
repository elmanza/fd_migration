require('dotenv').config();

const moment = require('moment');
const path = require('path');

const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;

const riteWay  = require("../../models/RiteWay/_riteWay");
const {ritewayDB} = require('../../config/database');

const {Quote:StageQuote} = require('../../models/Stage/index');

const FreightDragonService = require('../../utils/services/FreightDragonService');
const RiteWayAutotranportService = require('../../utils/services/RiteWayAutotranportService');
const HTTPService = require('../../utils/services/http/HTTPService');


const {FDConf} = require('../../config/conf');

const {Storage} = require('../../config/conf');

class RwFdSynchronize {
    constructor(){
        this.FDService = new FreightDragonService();
        this.RWService = new RiteWayAutotranportService();
        this.httpService = new HTTPService();

        this.finishedProcess = {
            createFDQuoteSyncTask:true,
            quoteToOrderSyncTask:true,
            sendNotesSyncTask:true,
            refreshRWEntitySyncTask:true
        };

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
                    },
                    {
                        model: riteWay.Driver,
                        require: false,
                        include: [
                            {
                                model: riteWay.Carrier,
                                require: false,
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
    //Create quotes---------------------------------------------------------
    async createFDQuote(riteWayQuote){
        let stageQuote = null;
        try{
            let res = await this.FDService.createQuote(riteWayQuote);

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

    createFDQuoteSyncTask(){
        if(!this.finishedProcess.createFDQuoteSyncTask){
            return null;
        }        
        console.log((new Date()).toString() + "createQuotes task is called........................");
        let recProccesed = 0;
        this.finishedProcess.createFDQuoteSyncTask = false;

        riteWay.Quote.findAll({
            include: this.quoteIncludeData,
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
                        Sequelize.col('quotes.fd_number'),
                        'IS',
                        null
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
                this.finishedProcess.createFDQuoteSyncTask = true;
            }
            quotes.forEach(quote => {   
                recProccesed++;              
                this.createFDQuote(quote)
                .then(result => {
                    console.log("createFDQuoteSyncTask ", result);
                })
                .catch(error => {
                    console.log("createFDQuoteSyncTask Error ", error);
                })
                .finally(()=>{
                    recProccesed--;
                    if(recProccesed<=0){
                        this.finishedProcess.createFDQuoteSyncTask = true;
                    }
                });
            });
        });
    }

    //Quotes to orders---------------------------------------------------------
    async quoteToOrder(riteWayQuote){
        //Update quote with all data
        let res = await this.FDService.update(riteWayQuote.stage_quote.fdOrderId, riteWayQuote);      
    
        res = await this.FDService.quoteToOrder(riteWayQuote.stage_quote.fdOrderId);
        
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
    
    quoteToOrderSyncTask(){
        if(!this.finishedProcess.quoteToOrderSyncTask){
            return null;
        }
        console.log((new Date()).toString() + "quotesToOrders task is called........................");
        let recProccesed = 0;
        this.finishedProcess.quoteToOrderSyncTask = false;

        riteWay.Quote.findAll({
            include: this.quoteIncludeData,
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
                this.finishedProcess.quoteToOrderSyncTask = true;
            }
            quotes.forEach(quote => {        
                recProccesed++;         
                this.quoteToOrder(quote)
                .then(res => {
                    console.log("quoteToOrderSyncTask", res);
                })
                .catch(error => {
                    console.log("quoteToOrderSyncTask Error", error);
                })
                .finally(()=>{
                    recProccesed--;
                    if(recProccesed <= 0){
                        this.finishedProcess.quoteToOrderSyncTask = true;
                    }                    
                });
            });
        });
    }

    //Refresh RW ENtities---------------------------------------------------------

    async syncFiles(res, riteWayQuote){
        let FDEntity = res.Data;
        let fdFiles = (res.Success ? res.Data.files : []);
        let hashFiles = {};
        let filesToFD = [];
        let filesToRW = [];
        let folder = `tmp/quote_${riteWayQuote.id}`

        riteWayQuote.order.orderDocuments.forEach(rwFile => {
            hashFiles[rwFile.name] = {
                existIn: 'rw',
                url: rwFile.urlFile,
                name: rwFile.name
            };
        });

        riteWayQuote.vehicles.forEach(vehicle => {
            let fileName = null;
            if(vehicle.gatePass != null && vehicle.gatePass != ''){
                fileName = path.basename(vehicle.gatePass);
            }

            if(fileName != null){
                hashFiles[fileName] = {
                    existIn: 'rw',
                    url: vehicle.gatePass,
                    name: fileName
                };
            }
        });

        fdFiles.forEach(fdFile => {
            if(typeof hashFiles[fdFile.name_original] == 'undefined'){
                hashFiles[fdFile.name_original] = {
                    existIn: 'fd',
                    url: fdFile.url,
                    name: fdFile.name_original
                };
            }
            else{
                hashFiles[fdFile.name_original].existIn = 'both'
            }
        });

        files = Object.values(hashFiles).file(file => file.existIn != 'both');

        for(let i = 0; i < files.length; i++){
            let file = files[i];
            let dFilePath = await HTTPService.downloadFile(file.url, folder, file.name);
            if(dFilePath){
                file.path = dFilePath;
                if(file.existIn == 'rw'){
                    this.FDService.sendFiles(FDEntity.FDOrderID, file);
                }
                else{
                    this.RWService.sendFiles(riteWayQuote.order.id, file);
                }
            }
        };
        
    }

    async syncInvoice(res, riteWayQuote){

        let invoice = await riteWay.Invoice.findOne({
            where: {
                order_id: riteWayQuote.order.id
            }
        });

        if(invoice == null || !res.Success){
            return;
        }

        let fdInvoiceURL = (res.Data.invoice_file ? FDConf.host + res.Data.invoice_file : null);
        let folder = `tmp/quote_${riteWayQuote.id}/invoice`;
        if(fdInvoiceURL){
            let fileName = path.basename(fdInvoiceURL);
            let filePath = await HTTPService.downloadFile(fdInvoiceURL, folder, fileName);    
            console.log(filePath);
            if(filePath){
                let fileData = {
                    name: fileName,
                    path: filePath
                };

                this.RWService.uploadInvoice(invoice.id, fileData);
            }            
        }
    }

    async refreshRWQuote(res, riteWayQuote){
        if(res.Success){
            let fdQuote = res.Data;
            let quoteData = {
                tariff: Number(fdQuote.tariff),
                state: 'waiting',
                fd_id: fdQuote.id,
                fd_number: fdQuote.FDOrderID
            };
            let stageStatus = '';

            if(riteWayQuote.offered_at == null){
                quoteData.offered_at = fdQuote.ordered||fdQuote.created;
            }

            await riteWayQuote.update(quoteData);

            if(quoteData.tariff > 0){   

                for(let j=0; j<riteWayQuote.vehicles.length; j++){
                    let rwVehicle = riteWayQuote.vehicles[j];

                    for(let k=0; k<fdQuote.vehicles.length; k++){
                        let fdVehicle = fdQuote.vehicles[k];
                        if(
                            (rwVehicle.vin ==  fdVehicle.vin) || 
                            (
                                rwVehicle.year ==  fdVehicle.year
                                && rwVehicle.vehicle_model.vehicle_maker.name == fdVehicle.make
                                && rwVehicle.vehicle_model.name == fdVehicle.model
                                && rwVehicle.vehicle_type.name == fdVehicle.type
                            )
                            ){
                            await rwVehicle.update({
                                tariff: Number(fdVehicle.tariff),
                                deposit: Number(fdVehicle.deposit),
                                carrierPay: Number(fdVehicle.carrier_pay),
                            });
                            break;
                        }
                    }
                }
            }

            if(fdQuote.type < 3){
                if(quoteData.tariff > 0){
                    quoteData.state = 'offered';
                }
                else{
                    quoteData.state = 'waiting';
                }

                let fdStatus = this.RWService._parseStatus(fdQuote.status);
                if(fdStatus == 'cancelled'){
                    quoteData.state = fdStatus;
                    quoteData.deletedAt = fdQuote.archived;
                }
            }
            else{
                quoteData.state = 'accepted'
            }

            stageStatus = quoteData.state;

            if(quoteData.state == 'accepted'){

                let {originLocation, destinationLocation} = this.RWService.getOriginDestinationLocations(fdQuote);
                let orderData = this.RWService.getOrderData(fdQuote);
                
                stageStatus = orderData.status;

                if(riteWayQuote.order){
                    //Update origin
                    await riteWayQuote.order.originLocation.update(originLocation);
                    if(riteWayQuote.order.originLocation.contact_information){
                        await riteWayQuote.order.originLocation.contact_information.update(originLocation.contact_information);
                    }
                    else{
                        await riteWay.ContactInformation.create({
                                ...originLocation.contact_information, 
                                location_id: originLocation.id,
                        });
                    }
                    //Update destination
                    await riteWayQuote.order.destinationLocation.update(destinationLocation);
                    if(riteWayQuote.order.destinationLocation.contact_information){
                        await riteWayQuote.order.destinationLocation.contact_information.update(destinationLocation.contact_information);
                    }
                    else{
                        await riteWay.ContactInformation.create({
                                ...destinationLocation.contact_information, 
                                location_id: destinationLocation.id,
                        });
                    }
                    //Update order
                    await riteWayQuote.order.update(orderData);
                }
                else{
                    originLocation = await riteWay.Location.create(originLocation);
                    await riteWay.ContactInformation.create({
                        ...originLocation.contact_information, 
                        location_id: originLocation.id
                    });
                    destinationLocation = await riteWay.Location.create(destinationLocation);
                    await riteWay.ContactInformation.create(
                    {
                        ...destinationLocation.contact_information,
                        location_id: destinationLocation.id,
    
                    });
                    await riteWay.Order.create({
                        ...orderData, 
                        quote_id: riteWayQuote.id, 
                        user_accept_id: riteWayQuote.user.id,
                        location_destination_id: destinationLocation.id,
                        location_origin_id: originLocation.id,
                    });
                }
            }

            await riteWayQuote.update(quoteData);
            await riteWayQuote.stage_quote.update({
                status: stageStatus,
                fdResponse: "fd_get_quote_sucess"
            });

            return res.Success ? "Quote refreshed. Quote ID "+riteWayQuote.id: 'fd_get_order_error';
        }
        else{
            await riteWayQuote.stage_quote.update({
                status: "fd_get_quote_error",
                fdResponse: JSON.stringify(res)
            });
            return "fd_get_quote_error quote_id: "+riteWayQuote.id+ " company: "+riteWayQuote.company.name;
        }
    }

    async refreshRWOrder(res, riteWayQuote){
        if(res.Success){
            let fdOrder = res.Data;
            let fdStatus = riteWayQuote.order.status == 'issues' ? 'issues' : this.RWService._parseStatus(fdOrder.status);
            let totalPaid = 0;
            let lastPaymentDate = null;

            let getRWStatus = function(status){
                if(["active", "onhold", "posted", "notsigned", "dispatched"].includes(status)){
                    return 'dispatched';
                }
                else if(["cancelled", "pickedup", "delivered", "issues"].includes(status)){
                    return status;
                }
            };

            await riteWayQuote.order.reload();
            //Se asigna el carrier y driver
            let {carrier, driver} = await this.RWService.processFDCarrierDriver(fdOrder, riteWayQuote.order);
            if(carrier != null){

                if(typeof carrier.id == 'undefined'){
                    carrier = await riteWay.Carrier.create(carrier);
                }

                if(riteWayQuote.order.driver){
                    riteWayQuote.order.driver.update(driver);
                }
                else{
                    if(typeof carrier.id != 'undefined' && driver != null){
                        await riteWay.Driver.create({
                            ...driver,
                            order_id: riteWayQuote.order.id,
                            carrier_id: carrier.id
                        });
                    }
                }           
            }

            //Se procesa los pagos e invoice
            let paymentsInvoiceData = await this.RWService.processFDPayments(fdOrder, riteWayQuote.order, riteWayQuote.company);

            await riteWay.Payment.destroy({
                where: {
                    order_id: riteWayQuote.order.id
                }
            });
            //Se crean los pagos
            for(let i=0; i < paymentsInvoiceData.paymentsData.length; i++){
                let payment = paymentsInvoiceData.paymentsData[i];
                payment.order_id = riteWayQuote.order.id;
                await riteWay.Payment.create(payment);
            }

            //Se crea el invoice en caso de que no exista
            if(paymentsInvoiceData.invoiceData){
                let amount = Number(fdOrder.tariff);
                let invoiceData = paymentsInvoiceData.invoiceData;
                
                invoiceData.order_id = riteWayQuote.order.id;

                let invoice = await riteWay.Invoice.findOne({
                    where: {
                        order_id: riteWayQuote.order.id
                    }
                });

                if(invoice == null){
                    await riteWay.Invoice.create(invoiceData);
                }
                else{
                    await invoice.update(invoiceData);
                }

                if(invoice.url_invoice == null || invoice.url_invoice == ''){
                    await this.syncInvoice(res, riteWayQuote);
                }
            }

            //Se actualizan las notes
            let notes = await this.RWService.processFDNotes(fdOrder, riteWayQuote);
            for(let i = 0; i < notes.length; i++){
                await riteWay.Note.create(notes[i]);
            }

            //Se actualiza el estado de la orden
            let orderData = this.RWService.getOrderData(fdOrder);
            await riteWay.Order.update({
                ...orderData,
                status: fdStatus
            }, {
                where: {
                    id: riteWayQuote.order.id
                }
            });
            //Se actualiza los datos FD en la quote
            let quoteData = {
                fd_id: fdOrder.id,
                fd_number: fdOrder.FDOrderID,
                tariff: Number(fdOrder.tariff),
            };
            if(riteWayQuote.offered_at == null){
                quoteData.offered_at = fdOrder.ordered||fdOrder.created;
            }

            await riteWayQuote.update(quoteData);
            //Se actualiza el estado en el stage y se determina si se debe seguir vigilando
            await riteWayQuote.stage_quote.update({
                status: fdStatus,
                fdResponse: "fd_get_order_success",
                watch: Number(fdOrder.tariff) > paymentsInvoiceData.totalPaid && fdStatus != 'cancelled'
            });
        }
        else{
            await riteWayQuote.stage_quote.update({
                status: "fd_get_order_error",
                fdResponse: JSON.stringify(res)
            });
        }
        return res.Success ? "Order refreshed. Quote ID "+riteWayQuote.id: 'fd_get_order_error';
    }

    async refreshRWEntity(stageQuote){
        let riteWayQuote = await riteWay.Quote.findByPk(stageQuote.riteWayId, {
            include: this.quoteIncludeData,
            paranoid: false
        });        
        if(riteWayQuote.state == 'waiting'){
            let isOffered  = true;
            let res = null;

            riteWayQuote.vehicles.forEach(vehicle => {
                isOffered = isOffered && Number(vehicle.tariff) > 0;
            });
            
            if(isOffered){
                //Update the entity with all data
                res = await this.FDService.update(stageQuote.fdOrderId, riteWayQuote);
            }
            res = await this.FDService.get(stageQuote.fdOrderId);

            return await this.refreshRWQuote(res, riteWayQuote);
        }
        else if(riteWayQuote.order != null){
            //Update the entity with all data
            //let res = await this.FDService.update(stageQuote.fdOrderId, riteWayQuote);
            //-------------------------------------
            let res = await this.FDService.get(stageQuote.fdOrderId);            
            return await this.refreshRWOrder(res, riteWayQuote);
        }
        else{
            return null;
        }
}

    refreshRWEntitySyncTask(){
        if(!this.finishedProcess.refreshRWEntitySyncTask){
            return null;
        }
        console.log((new Date()).toString() + "refreshRWEntity task is called........................");
        let recProccesed = 0;
        this.finishedProcess.refreshRWEntitySyncTask = false;
        
        let getRecords = async () => {
            let totalRecords = 0;
            let recordsCount = 0;
            let offset = 0;
            do{
                let result = await StageQuote.findAndCountAll({
                    where: {
                        'watch': true,
                        'fdOrderId': {
                            [dbOp.not]: null
                        }
                    },
                    offset,
                    limit: 100
                });

                totalRecords = result.count;
                recordsCount += result.rows.length;

                result.rows.forEach(stageQuote => {
                    recProccesed++;
                    this.refreshRWEntity(stageQuote)
                    .then(result => {
                        console.log("refreshRWEntitySyncTask ",result);
                    })
                    .catch(error => {
                        console.log("refreshRWEntitySyncTask Error ", error, stageQuote.fdOrderId);
                    })
                    .finally(()=>{
                        recProccesed--;
                        if(recProccesed <= 0){
                            this.finishedProcess.refreshRWEntitySyncTask = true;
                        }
                    });
                });

                if(totalRecords == 0){
                    this.finishedProcess.refreshRWEntitySyncTask = true;
                }

                offset++;
            }while( recordsCount < totalRecords );
            return true;
        }
        getRecords();
    }

    //Add Notes---------------------------------------------------------
    async sendNotes(stageQuotes){
        for(let i = 0; i<stageQuotes.length; i++){
            const stageQuote = stageQuotes[i];

            let notes = await riteWay.Note.findAll({
                attributes:[
                    'text',
                    'showOnCustomerPortal',
                    [Sequelize.literal("to_char(created_at::timestamp, 'YYYY-MM-DD HH:mm:ss')"), 'createdAt']
                ],
                include: {
                    model: riteWay.User, 
                    required:true
                },
                where:{
                    quoteId: stageQuote.quote.id
                }
            });

            if(notes.length > 0){
                let rData = {
                    FDOrderID: stageQuote.fdOrderId,
                    Notes: (new Buffer(JSON.stringify(notes.map(note => {
                        let data = {
                            sender: note.user.username,
                            sender_customer_portal: note.showOnCustomerPortal,
                            created: note.createdAt,
                            text: note.text
                        };
                        return data;
                    })))).toString('base64'),
                };
                let res = await this.FDService.sendNotes(rData);
                console.log(res.Success ? notes.length+" notes of Quote ID "+stageQuote.quote.id+" sended": 'fd_get_order_error');
            }
        }
        return true;
    }
    
    sendNotesSyncTask(){
        if(!this.finishedProcess.sendNotesSyncTask){
            return null;
        }
        console.log((new Date()).toString() + "sendOrderNotes task is called........................");
        this.finishedProcess.sendNotesSyncTask = false;

        StageQuote.findAll({
            include: [
                {
                    model: riteWay.Quote,
                    require: true,
                    include: [
                        {
                            model: riteWay.Order,
                            require: true,
                            include: []
                        },
                        {
                            model: riteWay.Note,
                            require: true,
                            include: [{
                                model: riteWay.User,
                                require: true
                            }]
                        }
                    ],
                    paranoid: false
                }
            ],
            where: {
                [dbOp.and] : [
                    Sequelize.where(
                        Sequelize.col('quote.order.id'),
                        'IS NOT',
                        null
                    ),
                    {
                        'status': {
                            [dbOp.notIn]: ['waiting', 'offered']
                        },
                        'rite_way_id': {
                            [dbOp.not]: null
                        },
                        'fd_order_id': {
                            [dbOp.not]: null
                        },
                        'watch': true
                    }
                ]
            }
        })
        .then( stageQuotes => {
            this.sendNotes(stageQuotes)
            .then(result => {
                //console.log("sendNotesSyncTask", result);
            })
            .catch(error => {
                console.log("sendNotesSyncTask Error", error);
            })
            .finally(()=>{
                this.finishedProcess.sendNotesSyncTask = true;
            });
        });
    }
}

module.exports = RwFdSynchronize;