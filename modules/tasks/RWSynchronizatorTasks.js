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
        };

        this.finished = {
            createQuote: true,
            quoteToOrder: true
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

        threads.push(this.pools.createQuote.exec('quoteToOrder', []));

        let results = await Promise.all(threads);
        this.finished.quoteToOrder = true;
    }
}



module.exports = RWSynchronizatorTasks;