require('dotenv').config();

const moment = require('moment');

const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;

const riteWay  = require("../../models/RiteWay/_riteWay");
const {ritewayDB} = require('../../config/database');

const StageQuote = require('../../models/Stage/quote');

const FreightDragonService = require('../../utils/services/FreightDragonService');
const RiteWayAutotranportService = require('../../utils/services/RiteWayAutotranportService');

class RwFdSynchronize {
    constructor(){
        this.FDService = new FreightDragonService();
        this.RWService = new RiteWayAutotranportService();

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
    async refreshRWQuote(res, riteWayQuote){
        if(res.Success){
            let fdQuote = res.Data;
            
            await riteWayQuote.update({
                fd_id: fdOrder.id,
                fd_number: fdQuote.FDOrderID,
            });

            if(fdQuote.tariff > 0){   

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
                                tariff: fdVehicle.tariff,
                                deposit: fdVehicle.deposit,
                                carrierPay: fdVehicle.carrier_pay,
                            });
                            break;
                        }
                    }
                }

                await riteWayQuote.update({
                    state: 'offered',
                    tariff: fdQuote.tariff
                });
                await riteWayQuote.stage_quote.update({
                    status: 'offered',
                    fdResponse: "fd_get_quote_sucess"
                }); 
            }
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
            let fdStatus = this.RWService._parseStatus(fdOrder.status);

            if(riteWayQuote.order.status != 'issues'){
                let getRWStatus = function(status){
                    if(["active", "onhold", "posted", "notsigned", "dispatched"].includes(status)){
                        return 'dispatched';
                    }
                    else if(["cancelled", "pickedup", "delivered", "issues"].includes(status)){
                        return status;
                    }
                };

                await riteWayQuote.order.reload();
                //Se crea una nota por el cambio del estado
                if(getRWStatus(fdStatus)!=getRWStatus(riteWayQuote.order.status)){
                    await riteWay.Note.create({
                        text: `The order ${riteWayQuote.id} changes status to ${getRWStatus(fdStatus)}`,
                        showOnCustomerPortal: true, 
                        userId: riteWayQuote.company.operatorUser.id, 
                        createdAt:ritewayDB.fn('NOW'), 
                        updatedAt:ritewayDB.fn('NOW'),
                        orderId: riteWayQuote.order.id
                    });
                }
                //Se actualiza el estado
                await riteWay.Order.update({
                    status: fdStatus
                }, {
                    where: {
                        id: riteWayQuote.order.id,
                        status: {
                            [dbOp.ne]: 'issues'
                        }
                    }
                });
                //Si fue entregada se crea el invoice en caso de que no exista
                if(fdStatus == 'delivered'){
                    let invoice = await riteWay.Invoice.findOne({
                        where: {
                            order_id: riteWayQuote.order.id
                        }
                    });

                    if(invoice == null){

                        let amount = 0;

                        riteWayQuote.vehicles.forEach(vehicle => {
                            amount += (vehicle?Number.parseFloat(vehicle.tariff) :0);
                        });


                        await riteWay.Invoice.create({
                            status: 'pending',
                            amount: amount,
                            order_id: riteWayQuote.order.id
                        });
                    }
                }
            }

            await riteWayQuote.stage_quote.update({
                status: fdStatus,
                fdResponse: "fd_get_order_success"
            }); 

            await riteWayQuote.update({
                fd_id: fdOrder.id,
                fd_number: fdQuote.FDOrderID,
            });

            //Search if exist note
            let usersList = {};
            
            for(let iN=0; iN < fdOrder.notes.length; iN++){
                let fdNote = fdOrder.notes[iN];
                let rwUser = null;

                if(typeof usersList[fdNote.email] == 'undefined'){
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
                    let rwNote = await riteWay.Note.findOne({
                        where: {
                            [dbOp.and] : [
                                Sequelize.where(
                                    Sequelize.col('notes.order_id'),
                                    '=',
                                    riteWayQuote.order.id
                                ),
                                Sequelize.where(
                                    Sequelize.col('notes.user_id'),
                                    '=',
                                    rwUser.id
                                ),
                                /* Sequelize.where(
                                    Sequelize.literal("created_at::timestamp"),
                                    '=',
                                    fdNote.created
                                ), */
                                Sequelize.where(
                                    Sequelize.col('notes.text'),
                                    'ilike',
                                    `%${fdNote.text}%` 
                                )
                            ]
                        }
                    });   
                    if(rwNote == null){
                        await riteWay.Note.create({
                            orderId: riteWayQuote.order.id,
                            userId: rwUser.id,
                            createdAt: fdNote.created,
                            updatedAt: fdNote.created,
                            text: fdNote.text
                        });
                    }                 
                }
            }
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
                isOffered = isOffered && vehicle.tariff > 0;
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
            let res = await this.FDService.update(stageQuote.fdOrderId, riteWayQuote);
            //-------------------------------------
            res = await this.FDService.get(stageQuote.fdOrderId);            
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
        let recProccesed = 0;
        this.finishedProcess.refreshRWEntitySyncTask = false;

        StageQuote.findAll({
            where: {
                'watch': true,
                'fdOrderId': {
                    [dbOp.not]: null
                }
            }
        })
        .then( stageQuotes => {
            if(stageQuotes.length == 0){
                this.finishedProcess.refreshRWEntitySyncTask = true;
            }
            stageQuotes.forEach(stageQuote => {
                recProccesed++;
                this.refreshRWEntity(stageQuote)
                .then(result => {
                    console.log("refreshRWEntitySyncTask ",result);
                })
                .catch(error => {
                    console.log("refreshRWEntitySyncTask Error ", error, stageQuote.id);
                })
                .finally(()=>{
                    recProccesed--;
                    if(recProccesed <= 0){
                        this.finishedProcess.refreshRWEntitySyncTask = true;
                    }
                });
            });
        });
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
                    orderId: stageQuote.quote.order.id
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
        
        this.finishedProcess.sendNotesSyncTask = false;

        StageQuote.findAll({
            include: [
                {
                    model: riteWay.Quote,
                    require: true,
                    include: [{
                            model: riteWay.Order,
                            require: true,
                            include: [{
                                model: riteWay.Note,
                                require: true,
                                include: [{
                                    model: riteWay.User,
                                    require: true
                                }]
                            }]
                    }],
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
                        }
                    }
                ]
            }
        })
        .then( stageQuotes => {
            this.sendNotes(stageQuotes)
            .then(result => {
                console.log("sendNotesSyncTask");
                console.log(result);
            })
            .catch(error => {
                console.log("sendNotesSyncTask Error");
                console.log(error);
            })
            .finally(()=>{
                this.finishedProcess.sendNotesSyncTask = true;
            });
        });
    }
}

module.exports = RwFdSynchronize;