

const moment = require('moment');
const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const RiteWayAutotransportSyncService = require('../rite_way/services/RiteWayAutotransportSyncService');
const FreightDragonService = require('../freight_dragon/services/FreightDragonService');

const { RiteWay, Stage } = require('../../models');
const { ritewayDB } = require('../../config/database');

const RwSyncService = new RiteWayAutotransportSyncService();
const FDService = new FreightDragonService();

const { QUOTE_STATUS, ORDER_STATUS, FD_STATUS } = require('../../utils/constants');
const Logger = require('../../utils/logger');

async function createQuote() {

    let sendRequestCreateFDQuote = async (quote) => {
        try {
            let stageQuote = null;
            let res = await FDService.createQuote(quote);
            
            if (res.Success) {
                let stageQuoteData = {
                    riteWayId: quote.id,
                    fdOrderId: res.EntityID,
                    fdAccountId: res.AccountID,
                    fdResponse: JSON.stringify(res),
                    status: QUOTE_STATUS.WAITING
                };

                let quoteData = {
                    fd_number: res.EntityID
                };

                stageQuote = await Stage.StageQuote.create(stageQuoteData);
                await quote.update(quoteData);
                Logger.info(`sendRequestCreateFDQuote success ${res.EntityID}`);
            }
            else {
                let stageQuoteData = {
                    riteWayId: quote.id,
                    status: "fd_quote_creation_error",
                    fdResponse: JSON.stringify(res)
                };

                stageQuote = await Stage.StageQuote.create(stageQuoteData);
                Logger.error(`sendRequestCreateFDQuote FDService. Error: ${JSON.stringify(res)}`);
            }

        }
        catch (e) {
            Logger.error(`sendRequestCreateFDQuote. Error: ${e.message}`);
            Logger.error(e);
        }
    };


    let quotes = await RiteWay.Quote.findAll({
        include: RwSyncService.quoteIncludeData(false),
        where: {
            [sqOp.and]: [
                Sequelize.where(
                    Sequelize.col('Company.customerDetail.operator_id'),
                    'IS NOT',
                    null
                ),
                // Sequelize.where(
                //     Sequelize.col('orderInfo.id'),
                //     'IS',
                //     null
                // ),
                {
                    [sqOp.or]: [
                        Sequelize.where(
                            Sequelize.col('Quote.status_id'),
                            '=',
                            2
                        )
                        // {
                        //     [sqOp.and]: [
                        //         Sequelize.where(
                        //             Sequelize.col('Company.customerDetail.auto_quoter'),
                        //             '=',
                        //             true
                        //         ), Sequelize.where(
                        //             Sequelize.col('Quote.status_id'),
                        //             '=',
                        //             QUOTE_STATUS.OFFERED
                        //         )
                        //     ]
                        // }
                    ]
                },
                Sequelize.where(
                    Sequelize.col('Quote.company_id'),
                    '=',
                    144360
                ),
                // Sequelize.where(
                //     Sequelize.col('fd_number'),
                //     'IS',
                //     null
                // ),
                Sequelize.where(
                    Sequelize.col('stage_quote.id'),
                    'IS',
                    null
                ),
            ]
        }
    });

    let promises = [];
    for (const quote of quotes) {
        promises.push(sendRequestCreateFDQuote(quote));
    }
    
    let results = await Promise.all(promises);
    return true;
}

async function quoteToOrder() {

    let sendRequestQuoteToOrder = async (quote) => {
        try {
            let res = await FDService.update(quote.fd_number, quote);

            res = await FDService.quoteToOrder(quote.fd_number);
            console.log("alskhdlakshdlka RES");
            console.log(res);
            if (res.Success) {
                // await quote.stage_quote.update({
                //     status: QUOTE_STATUS.ACTIVE,
                //     fdOrderId: res.EntityID,
                //     fdResponse: 'Ordered',
                //     ordered: true
                // });

                await quote.update({
                    fd_number: res.EntityID
                });

                Logger.info(`sendRequestQuoteToOrder success Order created ${res.EntityID}`);
            }
            else {
                // await quote.stage_quote.update({
                //     status: "fd_order_creation_error",
                //     fdResponse: JSON.stringify(res)
                // });

                Logger.info(`sendRequestQuoteToOrder success ${res.EntityID}`);
            }
        }
        catch (error) {
            Logger.error(`sendRequestCreateFDQuote. Error: ${error.message}`);
            Logger.error(error);
        }
    };

    let quotes = await RiteWay.Quote.findAll({
        include: RwSyncService.quoteIncludeData(false),
        where: {
            [sqOp.and]: [
                Sequelize.where(
                    Sequelize.col('Company.customerDetail.operator_id'),
                    'IS NOT',
                    null
                ),
                Sequelize.where(
                    Sequelize.col('orderInfo.id'),
                    'IS NOT',
                    null
                ),
                Sequelize.where(
                    Sequelize.col('orderInfo.status_id'),
                    '=',
                    4
                ),
                Sequelize.where(
                    Sequelize.col('Quote.status_id'),
                    '=',
                    QUOTE_STATUS.ORDERED
                ),
                Sequelize.where(
                    Sequelize.col('Quote.company_id'),
                    '=',
                    144360
                ),
                Sequelize.where(
                    Sequelize.col('fd_number'),
                    'IS NOT',
                    null
                )
            ]
        }
    });

    let promises = [];
    for (const quote of quotes) {
        console.log("-----> ",quote.id);
        promises.push(sendRequestQuoteToOrder(quote));
    }

    let results = await Promise.all(promises);
    return true;
}

async function refreshQuotes(page, limit) {
    try {
        console.log('refreshQuotes|||||||||||||||||||||', page, limit)

        let stagesQ = await Stage.StageQuote.findAll({
            include: {
                model: RiteWay.Quote,
                required: true,
                where: {
                    status_id: [QUOTE_STATUS.WAITING, QUOTE_STATUS.OFFERED]
                },
                paranoid: false
            },
            where: {
                'watch': true,
                'fdOrderId': {
                    [sqOp.not]: null
                }
            },
            offset: page * limit,
            limit: limit
        });

        let quotes = await RiteWay.Quote.findAll({
            include: RwSyncService.quoteIncludeData(),
            where: {
                id: stagesQ.map(sq => sq.riteWayId)
            },
            paranoid: false
        });

        if (quotes.length == 0) return true;

        let indexedQuotes = {};

        let fdOrdersIds = quotes.map((quote, idx) => {
            indexedQuotes[quote.fd_number] = quote;
            return quote.fd_number;
        }).join('|');

        let response = await FDService.getBatch(fdOrdersIds);

        if (response.Success) {
            let FDEntities = response.Data;

            for (FDEntity of FDEntities) {
                const quote = indexedQuotes[FDEntity.FDOrderID];
                const result = await RwSyncService.updateRWEntity(FDEntity, quote);
                if (result) Logger.info(`All changes was updated of  ${quote.fd_number}`);
            }
        }
        return true;
    }
    catch (error) {
        Logger.error(error);
        return false;
    }
}

async function refreshOrders(page, limit) {
    try {
        console.log('refreshOrders|||||||||||||||||||||', page, limit)

        let stagesQ = await Stage.StageQuote.findAll({
            include: {
                model: RiteWay.Quote,
                required: true,
                include: {
                    model: RiteWay.Order,
                    as: 'orderInfo',
                    required: true,
                    where: {
                        status_id: {
                            [sqOp.notIn]: [ORDER_STATUS.DELIVERED]
                        }
                    },
                    paranoid: false
                },
                paranoid: false
            },
            where: {
                'watch': true,
                'fdOrderId': {
                    [sqOp.not]: null
                }
            },
            offset: page * limit,
            limit: limit
        });

        let quotes = await RiteWay.Quote.findAll({
            include: RwSyncService.quoteIncludeData(),
            where: {
                id: stagesQ.map(sq => sq.riteWayId)
            },
            paranoid: false
        });

        if (quotes.length == 0) return true;

        let indexedQuotes = {};

        let fdOrdersIds = quotes.map((quote, idx) => {
            indexedQuotes[quote.fd_number] = quote;
            return quote.fd_number;
        }).join('|');

        let response = await FDService.getBatch(fdOrdersIds);

        if (response.Success) {
            let FDEntities = response.Data;

            for (FDEntity of FDEntities) {
                const quote = indexedQuotes[FDEntity.FDOrderID];
                const result = await RwSyncService.updateRWEntity(FDEntity, quote);
                if (result) Logger.info(`All changes was updated of  ${quote.fd_number}`);
            }
        }
        return true;
    }
    catch (error) {
        Logger.error(error);
        return false;
    }
}

async function refreshDeliveredOrders(page, limit) {
    try {
        console.log('refreshOrders|||||||||||||||||||||', page, limit)

        let stagesQ = await Stage.StageQuote.findAll({
            include: {
                model: RiteWay.Quote,
                required: true,
                include: {
                    model: RiteWay.Order,
                    as: 'orderInfo',
                    required: true,
                    where: {
                        status_id: ORDER_STATUS.DELIVERED
                    },
                    paranoid: false
                },
                paranoid: false
            },
            where: {
                'watch': true,
                'fdOrderId': {
                    [sqOp.not]: null
                }
            },
            offset: page * limit,
            limit: limit
        });

        let quotes = await RiteWay.Quote.findAll({
            include: RwSyncService.quoteIncludeData(),
            where: {
                id: stagesQ.map(sq => sq.riteWayId)
            },
            paranoid: false
        });

        if (quotes.length == 0) return true;

        let indexedQuotes = {};

        let fdOrdersIds = quotes.map((quote, idx) => {
            indexedQuotes[quote.fd_number] = quote;
            return quote.fd_number;
        }).join('|');

        let response = await FDService.getBatch(fdOrdersIds);

        if (response.Success) {
            let FDEntities = response.Data;

            for (FDEntity of FDEntities) {
                const quote = indexedQuotes[FDEntity.FDOrderID];
                const result = await RwSyncService.updateRWEntity(FDEntity, quote);
                if (result) Logger.info(`All changes was updated of  ${quote.fd_number}`);
            }
        }
        return true;
    }
    catch (error) {
        Logger.error(error);
        return false;
    }
}

async function syncInvoices(limit) {
    try{
    let quotes = await RiteWay.Quote.findAll({
        include: [
            {
                model: RiteWay.Company,
                required: true
            },
            {
                model: RiteWay.Order,
                required: true,
                as: 'orderInfo',
                include: {
                    model: RiteWay.Invoice,
                    required: true,
                    as: 'invoiceInfo',
                    where: {
                        invoice_url: ''
                    }
                },
                paranoid: false
            }
        ],
        where:{
            [sqOp.and]: [
                Sequelize.where(
                    Sequelize.col('orderInfo.created_at'),
                    '<=',
                    '2020-09-30 00:00:00'
                )
                ,
                Sequelize.where(
                    Sequelize.col('orderInfo.created_at'),
                    '>=',
                    '2020-09-01 00:00:00'
                )
                // ,
                // Sequelize.where(
                //     Sequelize.col('Company.id'),
                //     '=',
                //     '144360'
                // ),
            ]
        },
        limit:20,
        offset: 0,
        paranoid: false,
        order:[["created_at", "DESC"]]
    });

    console.log("Total ordenes ", quotes.length);

    let promises = [];
    for (const quote of quotes) {
        promises.push(RwSyncService.syncInvoice(quote));
    }

    let results = await Promise.all(promises);
    return true;
    }catch(err){
        console.log(err);
        return false;
    }
}


async function syncMyOrders(){
try{
    let quotes = await RiteWay.Quote.findAll({
        attributes: ['id', 'fd_number'],
        include: [
            {
                attributes: ['created_at'],
                model: RiteWay.Order,
                required: true,
                as: 'orderInfo',
                include: {
                    model: RiteWay.OrderDocument,
                    as: 'orderDocuments',
                    where: {
                        [sqOp.and]: [
                            Sequelize.where(
                                Sequelize.col('orderInfo.OrderDocument.id'),
                                'IS',
                                null
                            )
                        ]
                    }
                },
                where:{
                    [sqOp.and]: [
                        Sequelize.where(
                            Sequelize.col('orderInfo.created_at'),
                            '>',
                            '2021-12-01 00:00:00'
                        ),
                        Sequelize.where(
                            Sequelize.col('orderInfo.created_at'),
                            '<',
                            '2022-01-31 00:00:00'
                        ),
                    ]
                },
                paranoid: false
            }
        ],
        limit:30,
        offset: 0,
        paranoid: false,
        order:[["created_at", "DESC"]]
    });

    console.log("Total ordenes ", quotes.length);

    let promises = [];
    for (const quote of quotes) {
        promises.push(RwSyncService.syncInvoice(quote));
    }

    let results = await Promise.all(promises);
    return true;
    }catch(err){
        console.log(err);
        return false;
    }
}
function calcPagination(page = 0, pageSize = 20) {
    return {
      limit: pageSize,
      offset: page * pageSize
    };
  }

let syncDispatchSheetOnOrders = true;
async function syncDispatchSheet(limit) {
    try{
        if(syncDispatchSheetOnOrders){
            syncDispatchSheetOnOrders = false;
            let countQuery = `select
                                COUNT(quotes.id) as total
                            from
                                orders
                            inner join quotes on
                                orders.quote_id = quotes.id
                                and quotes.deleted_at is null
                            left join order_documents on
                                orders.id = order_documents.order_id
                                and order_documents.name ilike '%Dispatch sheet%'
                                where
                                orders."status_id" = 15
                                and order_documents.id is null`; 
            // let countQuery = `select
            //                     COUNT(quotes.id) as total
            //                 from
            //                     orders
            //                 inner join quotes on
            //                     orders.quote_id = quotes.id
            //                     and quotes.deleted_at is null
            //                 left join order_documents on
            //                     orders.id = order_documents.order_id
            //                     and order_documents.name ilike '%Dispatch sheet%'
            //                     where
            //                     orders."created_at" <= '2022-01-31 05:00:00.000 +00:00' and 
            //                     orders."created_at" >= '2019-01-01 05:00:00.000 +00:00'
            //                     and order_documents.id is null`; 
            // let countQuery = `select
            //                         COUNT(quotes.id) as total
            //                     from
            //                         orders
            //                     inner join quotes on
            //                         orders.quote_id = quotes.id
            //                         and quotes.deleted_at is null
            //                     left join order_documents on
            //                         orders.id = order_documents.order_id
            //                         and order_documents.name ilike '%Dispatch sheet%'
            //                         where
            //                         orders.id in (95704,
            //                             95705,
            //                             95706,
            //                             95707)
            //                         and order_documents.id is null`;                            
            let ordersCount = await ritewayDB.query(countQuery, {
                type: ritewayDB.QueryTypes.SELECT
                });
                console.log("laksndklasnd", ordersCount);
            let amountOrders = Number(ordersCount[0].total) || 0;
                if(amountOrders > 0){
                    
                    let totalPage = Math.ceil(amountOrders / limit);
                    let page = 0;
                    let doing = true;          
                    console.log(`Model: Order get dispatchsheet. BatchSize: ${limit}. Total Pages: ${totalPage}`);
                    while(doing){
                        let promises = [];
                        if(page > totalPage){
                            doing = false;
                            syncDispatchSheetOnOrders = true;
                        }
                        let limitAndOffset = calcPagination(page, limit);
                        let query = `select quotes.id as quote_id,
                                            quotes.fd_number,
                                            orders.id as order_id,
                                            orders."created_at",
                                            companies.id as company_id
                                      from orders
                                            inner join quotes on orders.quote_id = quotes.id and quotes.deleted_at is null
                                            inner join companies on quotes.company_id = companies.id
                                            left join  order_documents on orders.id = order_documents.order_id and order_documents.name ilike '%Dispatch sheet%'
                                       where
                                            orders."status_id" = 15
                                            and order_documents.id is null
                                            limit ${limitAndOffset.limit} offset ${limitAndOffset.offset}`;

                                
                        let orders = await ritewayDB.query(query, {
                            type: ritewayDB.QueryTypes.SELECT
                        });

                        console.log(`Page ${page} de ${totalPage}. VALOR DE doing ${doing}`);
            
                        for (const order of orders) {
                            promises.push(RwSyncService.syncDispatchSheet(order));
                        }
                        await Promise.all(promises);
                        page++;
                    } 
                    if(syncDispatchSheetOnOrders){
                        return true;
                    }
                }
            return true;
        }
    }catch(err){
        console.log(err);
        return false;
    }
}

async function syncInsertCompaniesWithoutCustomerDetails(limit) {
    try{
        if(syncDispatchSheetOnOrders){
            syncDispatchSheetOnOrders = false;
            let countQuery = `select
                                companies.name
                            from
                                orders
                            inner join quotes on
                                orders.quote_id = quotes.id
                            inner join companies on
                                quotes.company_id = companies.id
                            left join customer_details on
                                customer_details.company_id = companies.id
                            where
                                customer_details.id is null and companies.id <> 149
                            group by
                                companies.name,
                                customer_details.id,
                                companies.id
                            order by 
                            	companies.name`; 
                                      
            let ordersCount = await ritewayDB.query(countQuery, {
                type: ritewayDB.QueryTypes.SELECT
                });
                console.log("laksndklasnd", ordersCount);
            let amountOrders = Number(ordersCount.length) || 0;
                if(amountOrders > 0){
                    
                    let totalPage = Math.ceil(amountOrders / limit);
                    let page = 0;
                    let doing = true;          
                    console.log(`Model: Order get syncInsertCompaniesWithoutCustomerDetails. BatchSize: ${limit}. Total Pages: ${totalPage}`);
                    while(doing){
                        let promises = [];
                        if(page > totalPage){
                            doing = false;
                            syncDispatchSheetOnOrders = true;
                        }
                        let limitAndOffset = calcPagination(page, limit);
                        let query = `select
                                        customer_details.id as customer_id,
                                        companies.name,
                                        companies.id as company_id,
                                        jsonb_agg(orders.assigned_salesrep_id) as operator_id
                                    from
                                        orders
                                    inner join quotes on
                                        orders.quote_id = quotes.id
                                    inner join companies on
                                        quotes.company_id = companies.id
                                    left join customer_details on
                                        customer_details.company_id = companies.id
                                    where
                                        customer_details.id is null and companies.id <> 149
                                    group by
                                        companies.name,
                                        customer_details.id,
                                        companies.id
                                    order by 
                                        companies.name
                                    limit ${limitAndOffset.limit} offset ${limitAndOffset.offset}`;

                                
                        let orders = await ritewayDB.query(query, {
                            type: ritewayDB.QueryTypes.SELECT
                        });

                        console.log(`Page ${page} de ${totalPage}. VALOR DE doing ${doing}`);
            
                        for (const order of orders) {
                            promises.push(RwSyncService.syncInsertCompaniesWithoutCustomerDetails(order));
                        }
                        await Promise.all(promises);
                        page++;
                    } 
                    if(syncDispatchSheetOnOrders){
                        return true;
                    }
                }
            return true;
        }
    }catch(err){
        console.log(err);
        return false;
    }
}
async function updateOrdersData(limit2) {
    let limit = 50;
    try{
        if(syncDispatchSheetOnOrders){
            syncDispatchSheetOnOrders = false;
            // Query para ver los source id null
            let countQuery = `select
                                    count(distinct orders.id)::int as total
                                from
                                    orders   
                                where orders.source_id = -1 and 
                                orders."created_at" <= '2022-02-02 05:00:00.000 +00:00' and 
                                orders."created_at" >= '2021-01-01 05:00:00.000 +00:00'`; 
            // let countQuery = `select
            //                     count(distinct orders.id)::int as total
            //                 from
            //                     orders   
            //                 where orders.payment_method_id = 9 and 
            //                 orders."created_at" <= '2022-02-02 05:00:00.000 +00:00' and 
            //                 orders."created_at" >= '2021-01-01 05:00:00.000 +00:00'`; 
                        // let countQuery = select
                            // count(distinct orders.id)::int as total
                            // from
                            //     orders   
                            // inner join quotes on
                            //     orders.quote_id = quotes.id
                            //     and quotes.deleted_at is null
                            // inner join customer_details on
                            //     customer_details.company_id = quotes.company_id and (customer_details.hours = ''
                            // or customer_details.hours is null)
                            // inner join companies on
                            //     customer_details.company_id = companies.id
                            // where orders.source_id = -1 and 
                            // orders."created_at" <= '2022-01-31 05:00:00.000 +00:00' and 
                            // orders."created_at" >= '2021-12-01 05:00:00.000 +00:00' `;                            
            let ordersCount = await ritewayDB.query(countQuery, {
                type: ritewayDB.QueryTypes.SELECT
                });
                console.log("laksndklasnd", ordersCount);
            let amountOrders = Number(ordersCount[0].total) || 0;
                if(amountOrders > 0){
                    
                    let totalPage = Math.ceil(amountOrders / limit);
                    let page = 0;
                    let doing = true;          
                    console.log(`Model: Order get dispatchsheet. BatchSize: ${limit}. Total Pages: ${totalPage}`);
                    while(doing){
                        let promises = [];
                        if(page > totalPage){
                            doing = false;
                            syncDispatchSheetOnOrders = true;
                        }
                        let limitAndOffset = calcPagination(page, limit);
                        // select quotes.id as quote_id,
                        //                     quotes.fd_number,
                        //                     orders.id as order_id,
                        //                     orders."created_at",
                        //                     companies.id as company_id,
                        //                     companies.name
                        //                 from

                        // select
                        //                     quotes.fd_number,
                        //                     orders.id,
                        //                     orders.payment_method_id,
                        //                     orders.source_id
                        //                 from
                        // inner join quotes on orders.quote_id = quotes.id  
                        //                 where orders.payment_method_id = 9 and 
                        //                 orders."created_at" <= '2022-02-02 05:00:00.000 +00:00' and 
                        //                 orders."created_at" >= '2021-01-01 05:00:00.000 +00:00'
                        let query = `select quotes.id as quote_id,
                                            quotes.fd_number,
                                            orders.id,
                                            orders."created_at",
                                            companies.id as company_id,
                                            companies.name
                                        from
                                            orders   
                                        inner join quotes on orders.quote_id = quotes.id  
                                        inner join companies on quotes.company_id = companies.id  
                                        where orders.source_id = -1 and 
                                        orders."created_at" <= '2022-02-02 05:00:00.000 +00:00' and 
                                        orders."created_at" >= '2021-01-01 05:00:00.000 +00:00'
                                        limit ${limitAndOffset.limit} offset ${limitAndOffset.offset}`;

                                
                        let orders = await ritewayDB.query(query, {
                            type: ritewayDB.QueryTypes.SELECT
                        });

                        console.log(`Page ${page} de ${totalPage}. VALOR DE doing ${doing}`);
                        
                        let dooo = false;
                        for (const order of orders) {
                            if(page == totalPage) dooo = true;
                            promises.push(RwSyncService.updateOrdersData(order, dooo));
                        }
                        await Promise.all(promises);
                        page++;
                    } 
                    if(syncDispatchSheetOnOrders){
                        return true;
                    }
                }
            return true;
        }
    }catch(err){
        console.log(err);
        return false;
    }
}

module.exports = {
    createQuote,
    quoteToOrder,
    refreshQuotes,
    refreshOrders,
    refreshDeliveredOrders,
    syncInvoices,
    syncMyOrders,
    syncDispatchSheet,
    updateOrdersData,
    syncInsertCompaniesWithoutCustomerDetails
}