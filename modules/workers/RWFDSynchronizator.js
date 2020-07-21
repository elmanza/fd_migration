const workerpool = require('workerpool');

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
            let res = await FDService.createQuote(riteWayQuote);

            if (res.Success) {
                let stageQuoteData = {
                    riteWayId: quote.id,
                    fdOrderId: res.EntityID,
                    fdAccountId: res.AccountID,
                    fdResponse: JSON.stringify(res),
                    status: "waiting"
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
                    status: 'accepted',
                    fdOrderId: res.EntityID,
                    fdResponse: JSON.stringify(res)
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

async function refreshEntities(page) {

}

async function sendNotes() {

}

async function downloadInvoices() {

}

workerpool.worker({
    createQuote,
    quoteToOrder
});