const workerpool = require('workerpool');

const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const SyncParameters = require('../../config/sync_conf');

const { RiteWay, Stage } = require('../../models');
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
            refreshEntities: workerpool.pool(__dirname + '/../workers/RWFDSynchronizator.js', {
                minWorkers: 2,
                maxWorkers: 10,
                workerType: 'thread'
            }),
        };

        this.finished = {
            createQuote: true,
            quoteToOrder: true,
            refreshEntities: true
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

    async refreshEntities() {
        if (!this.finished.refreshEntities) return;
        this.finished.refreshEntities = false;
        Logger.info(`refreshEntities is executed`);


        let amountQuotes = await Stage.StageQuote.findAll({
            where: {
                'watch': true,
                'fdOrderId': {
                    [sqOp.not]: null
                }
            }
        });
        
        let threads = [];

        let totalPage = Math.ceil(amountQuotes / SyncParameters.batch_size);

        for (let page = 0; page < 1; page++) {
            threads.push(this.pools.refreshEntities.exec('refreshEntities', [page, SyncParameters.batch_size]));
        }
        
        let results = await Promise.all(threads);
        this.finished.refreshEntities = true;
    }
}



module.exports = RWSynchronizatorTasks;