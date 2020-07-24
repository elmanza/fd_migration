

const moment = require('moment');
const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const RiteWayAutotransportSyncService = require('../rite_way/services/RiteWayAutotransportSyncService');
const FreightDragonService = require('../freight_dragon/services/FreightDragonService');

const { RiteWay, Stage } = require('../../models');

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
                Sequelize.where(
                    Sequelize.col('orderInfo.id'),
                    'IS',
                    null
                ),
                Sequelize.where(
                    Sequelize.col('Quote.status_id'),
                    '=',
                    QUOTE_STATUS.WAITING
                ),
                Sequelize.where(
                    Sequelize.col('fd_number'),
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

            if (res.Success) {
                await quote.stage_quote.update({
                    status: QUOTE_STATUS.ACTIVE,
                    fdOrderId: res.EntityID,
                    fdResponse: 'Ordered',
                    ordered: true
                });

                await quote.update({
                    fd_number: res.EntityID
                });

                Logger.info(`sendRequestQuoteToOrder success Order created ${res.EntityID}`);
            }
            else {
                await quote.stage_quote.update({
                    status: "fd_order_creation_error",
                    fdResponse: JSON.stringify(res)
                });

                Logger.info(`sendRequestQuoteToOrder success ${res.EntityID}`);
            }
        }
        catch (error) {
            Logger.error(`sendRequestCreateFDQuote. Error: ${error.message}`);
            Logger.error(error);
        }
    };

    let quotes = await RiteWay.Quote.findAll({
        include: RwSyncService.quoteIncludeData(),
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
                    ORDER_STATUS.ACTIVE
                ),
                Sequelize.where(
                    Sequelize.col('Quote.status_id'),
                    '=',
                    QUOTE_STATUS.ORDERED
                ),
                Sequelize.where(
                    Sequelize.col('fd_number'),
                    'IS NOT',
                    null
                ),
                Sequelize.where(
                    Sequelize.col('stage_quote.watch'),
                    '=',
                    true
                ),
                Sequelize.where(
                    Sequelize.col('stage_quote.ordered'),
                    '=',
                    false
                ),
            ]
        }
    });

    let promises = [];
    for (const quote of quotes) {
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
                }
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
                    }
                }
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
                    }
                }
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
        limit,
        paranoid: false
    });

    let promises = [];
    for (const quote of quotes) {
        promises.push(RwSyncService.syncInvoice(quote));
    }

    let results = await Promise.all(promises);
    return true;
}

module.exports = {
    createQuote,
    quoteToOrder,
    refreshQuotes,
    refreshOrders,
    refreshDeliveredOrders,
    syncInvoices
}