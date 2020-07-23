const workerpool = require('workerpool');

const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const SyncParameters = require('../../config/sync_conf');

const { RiteWay, Stage } = require('../../models');
const { QUOTE_STATUS, ORDER_STATUS, FD_STATUS } = require('../../utils/constants');
const Logger = require('../../utils/logger');

class RWSynchronizatorTasks {
    constructor() {

        this.pools = {
            createQuote: workerpool.pool(__dirname + '/../workers/RWFDSynchronizator.js', {
                minWorkers: 1,
                maxWorkers: 1,
                workerType: 'thread'
            }),
            quoteToOrder: workerpool.pool(__dirname + '/../workers/RWFDSynchronizator.js', {
                minWorkers: 1,
                maxWorkers: 1,
                workerType: 'thread'
            }),
            refreshQuotes: workerpool.pool(__dirname + '/../workers/RWFDSynchronizator.js', {
                minWorkers: 1,
                maxWorkers: 1,
                workerType: 'thread'
            }),
            refreshOrders: workerpool.pool(__dirname + '/../workers/RWFDSynchronizator.js', {
                minWorkers: 3,
                maxWorkers: 10,
                workerType: 'thread'
            }),
            refreshDeliveredOrders: workerpool.pool(__dirname + '/../workers/RWFDSynchronizator.js', {
                minWorkers: 5,
                maxWorkers: 10,
                workerType: 'thread'
            }),
        };

        this.finished = {
            createQuote: true,
            quoteToOrder: true,
            refreshQuotes: true,
            refreshOrders: true,
            refreshDeliveredOrders: true
        }
    }

    async createQuote() {
        if (!this.finished.createQuote) return;
        this.finished.createQuote = false;

        Logger.info(`createQuote is executed`);
        let threads = [];

        threads.push(this.pools.createQuote.exec('createQuote', []));

        let results = await Promise.all(threads);
        this.finished.createQuote = true;
    }

    async quoteToOrder() {
        if (!this.finished.quoteToOrder) return;
        this.finished.quoteToOrder = false;

        Logger.info(`quoteToOrder is executed`);
        let threads = [];

        threads.push(this.pools.quoteToOrder.exec('quoteToOrder', []));

        let results = await Promise.all(threads);
        this.finished.quoteToOrder = true;
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
                }
            },
            where: {
                'watch': true,
                'fdOrderId': {
                    [sqOp.not]: null
                }
            }
        });
        if(amountQuotes == 0) {
            this.finished.refreshQuotes = true;
            return;
        }
        
        let threads = [];

        let totalPage = Math.ceil(amountQuotes / SyncParameters.batch_size);

        for (let page = 0; page < totalPage; page++) {
            threads.push(this.pools.refreshQuotes.exec('refreshQuotes', [page, SyncParameters.batch_size]));
        }
        
        let results = await Promise.all(threads);
        this.finished.refreshQuotes = true;
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
            }
        });
        if(amountQuotes == 0) {
            this.finished.refreshOrders = true;
            return;
        }
        
        let threads = [];

        let totalPage = Math.ceil(amountQuotes / SyncParameters.batch_size);

        for (let page = 0; page < totalPage; page++) {
            threads.push(this.pools.refreshOrders.exec('refreshOrders', [page, SyncParameters.batch_size]));
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
            }
        });
        if(amountQuotes == 0) {
            this.finished.refreshDeliveredOrders = true;
            return;
        }
        
        let threads = [];

        let totalPage = Math.ceil(amountQuotes / SyncParameters.batch_size);

        for (let page = 0; page < totalPage; page++) {
            threads.push(this.pools.refreshDeliveredOrders.exec('refreshDeliveredOrders', [page, SyncParameters.batch_size]));
        }
        
        let results = await Promise.all(threads);
        this.finished.refreshDeliveredOrders = true;
    }
}



module.exports = RWSynchronizatorTasks;