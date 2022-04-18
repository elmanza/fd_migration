const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const SyncParameters = require('../../config/sync_conf');

const { RiteWay, Stage } = require('../../models');
const { QUOTE_STATUS, ORDER_STATUS, FD_STATUS } = require('../../utils/constants');
const Logger = require('../../utils/logger');

const RWFDSynchronizatorWorker = require('../workers/RWFDSynchronizator');

class RWSynchronizatorTasks {
    constructor() {
        this.finished = {
            createQuote: true,
            quoteToOrder: true,
            refreshQuotes: true,
            refreshOrders: true,
            refreshDeliveredOrders: true,
            syncInvoices: true
        }
        this.doingQuerysyncMyOrders = null;
    }

    async createQuote() {
        if (!this.finished.createQuote) {
            console.log("No se ejecita createQuote");
            return;
        };
        this.finished.createQuote = false;

        Logger.info(`createQuote is executed`);
        let threads = [];
        threads.push(RWFDSynchronizatorWorker.createQuote());

        let results = await Promise.all(threads);
        // this.finished.createQuote = true;
    }

    async quoteToOrder() {
        if (!this.finished.quoteToOrder)  {
            console.log("No se ejecita quoteToOrder");
            return;
        };;
        this.finished.quoteToOrder = false;

        Logger.info(`quoteToOrder is executed`);
        let threads = [];

        threads.push(RWFDSynchronizatorWorker.quoteToOrder());

        let results = await Promise.all(threads);
        // this.finished.quoteToOrder = true;
    }

    async refreshQuotes() {
        if (!this.finished.refreshQuotes) return;
        this.finished.refreshQuotes = false;
        Logger.info(`refreshQuotes is executed`);


        let amountQuotes = await Stage.StageQuote.count({
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
            }
        });
        if (amountQuotes == 0) {
            this.finished.refreshQuotes = true;
            return;
        }

        let threads = [];

        let totalPage = Math.ceil(amountQuotes / SyncParameters.batch_size);

        for (let page = 0; page < totalPage; page++) {
            threads.push(RWFDSynchronizatorWorker.refreshQuotes(page, SyncParameters.batch_size));
        }

        let results = await Promise.all(threads);
        this.finished.refreshQuotes = true;
    }

    async createOrderFD(){
        if (!this.finished.refreshOrders) {
            console.log("No se puede ejecutar el createOrderFD");
            return;
        };
        this.finished.refreshOrders = false;
        Logger.info(`createOrderFD is executed`);
        let threads = [];

        threads.push(RWFDSynchronizatorWorker.quoteToOrder());

        let results = await Promise.all(threads);
    }

    async refreshOrders() {
        if (!this.finished.refreshOrders) return;
        this.finished.refreshOrders = false;
        Logger.info(`refreshOrders is executed`);


        let amountQuotes = await Stage.StageQuote.count({
            include: {
                model: RiteWay.Quote,
                required: true,
                include: {
                    model: RiteWay.Order,
                    as: 'orderInfo',
                    required: true,
                    where: {
                        status_id: {
                            [sqOp.ne]: ORDER_STATUS.DELIVERED
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
            }
        });
        if (amountQuotes == 0) {
            this.finished.refreshOrders = true;
            return;
        }

        let threads = [];

        let totalPage = Math.ceil(amountQuotes / SyncParameters.batch_size);

        for (let page = 0; page < totalPage; page++) {
            threads.push(RWFDSynchronizatorWorker.refreshOrders(page, SyncParameters.batch_size));
        }

        let results = await Promise.all(threads);
        this.finished.refreshOrders = true;
    }

    async refreshDeliveredOrders() {
        if (!this.finished.refreshDeliveredOrders) return;
        this.finished.refreshDeliveredOrders = false;
        Logger.info(`refreshDeliveredOrders is executed`);


        let amountQuotes = await Stage.StageQuote.count({
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
            }
        });
        if (amountQuotes == 0) {
            this.finished.refreshDeliveredOrders = true;
            return;
        }

        let threads = [];

        let totalPage = Math.ceil(amountQuotes / SyncParameters.batch_size);

        for (let page = 0; page < totalPage; page++) {
            threads.push(RWFDSynchronizatorWorker.refreshDeliveredOrders(page, SyncParameters.batch_size));
        }

        let results = await Promise.all(threads);
        this.finished.refreshDeliveredOrders = true;
    }

    async syncInvoices() {
        if (!this.finished.syncInvoices) {
            console.log("Estoy en this.finished.syncInvoices = ", this.finished.syncInvoices);
            return;
        }
        this.finished.syncInvoices = false;

        Logger.info(`syncInvoices is executed`);
        let threads = [];

        threads.push(RWFDSynchronizatorWorker.syncInvoices(SyncParameters.batch_size));

        let results = await Promise.all(threads);
        this.finished.syncInvoices = true;
    }

    
    async syncMyOrders() {
        if (this.doingQuerysyncMyOrders == null){
            this.finished.syncInvoices = false;

            Logger.info(`syncMyOrders is executed`);
            let threads = [];

            threads.push(RWFDSynchronizatorWorker.syncMyOrders());

            let results = await Promise.all(threads);
            this.finished.syncInvoices = true;
        }else{
            console.log("Estoy en this.finished.syncInvoices = ", this.finished.syncInvoices);
            return;
        }
        
    }

    async syncDispatchSheet() {
        if (!this.finished.syncInvoices) return;
        this.finished.syncInvoices = false;

        Logger.info(`syncInvoices is executed`);
        let threads = [];

        threads.push(RWFDSynchronizatorWorker.syncDispatchSheet(SyncParameters.batch_size));

        let results = await Promise.all(threads);
        // this.finished.syncInvoices = true;
        
    }

    async syncInsertCompaniesWithoutCustomerDetails() {
        if (!this.finished.syncInvoices) return;
        this.finished.syncInvoices = false;

        Logger.info(`syncInvoices is executed`);
        let threads = [];

        threads.push(RWFDSynchronizatorWorker.syncInsertCompaniesWithoutCustomerDetails(SyncParameters.batch_size));

        let results = await Promise.all(threads);
        // this.finished.syncInvoices = true;
        
    }


    


    async updateOrdersData(){
        if (!this.finished.syncInvoices) return;
        this.finished.syncInvoices = false;

        Logger.info(`updateOrdersData is executed`);
        let threads = [];

        threads.push(RWFDSynchronizatorWorker.updateOrdersData(SyncParameters.batch_size));

        let results = await Promise.all(threads);
        this.finished.syncInvoices = true;
    }

    
}



module.exports = RWSynchronizatorTasks;