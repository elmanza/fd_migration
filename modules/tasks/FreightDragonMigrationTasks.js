const workerpool = require('workerpool');

const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const SyncParameters = require('../../config/sync_conf');

const { RiteWay, Stage } = require('../../models');
const Logger = require('../../utils/logger');

class FreightDragonMigrationTasks {
    constructor() {

        this.pools = {
            migrateAll: workerpool.pool(__dirname + '/../workers/FreightDragonMigration.js', {
                minWorkers: 1,
                maxWorkers: 1,
                workerType: 'thread'
            }),
            migrateTodayEntities: workerpool.pool(__dirname + '/../workers/FreightDragonMigration.js', {
                minWorkers: 1,
                maxWorkers: 2,
                workerType: 'thread'
            }),
            operatorsMigration: workerpool.pool(__dirname + '/../workers/FreightDragonMigration.js', {
                minWorkers: 1,
                maxWorkers: 1,
                workerType: 'thread'
            })
        };

        this.finished = {
            migrateAll: true,
            migrateTodayEntities: true,
            operatorsMigration: true
        }
    }


    async migrateAll() {
        if (!this.finished.migrateAll) return;
        this.finished.migrateAll = false;

        Logger.info(`Migration All is executed`);

        let companies = await RiteWay.Company.findAll({
            include: [
                {
                    model: Stage.FdCompanies,
                    required: true,
                    include: {
                        model: Stage.MigratedCompany,
                        required: false
                    }
                },
            ],
            where: {
                [sqOp.and]: [
                    Sequelize.where(
                        Sequelize.col('FdCompanies.MigratedCompany.id'),
                        '=',
                        null
                    )
                ]
            },
            subQuery: false,
        });

        let threads = [];

        for (const company of companies) {
            threads.push(this.pools.migrateAll.exec('migrate', [company.id, false]));
        }
        let results = await Promise.all(threads);
        this.finished.migrateAll = true;
    }

    async migrateTodayEntities() {
        if (!this.finished.migrateTodayEntities) return;
        this.finished.migrateTodayEntities = false;

        Logger.info(`Migration Today is executed`);

        let companies = await RiteWay.Company.findAll({
            include: [
                {
                    model: Stage.FdCompanies,
                    required: true,
                    include: {
                        model: Stage.MigratedCompany,
                        required: false
                    }
                },
            ],
            where: {
                [sqOp.and]: [
                    Sequelize.where(
                        Sequelize.col('FdCompanies.MigratedCompany.migrated'),
                        '=',
                        true
                    )
                ]
            },
            subQuery: false,
        });

        let threads = [];

        for (const company of companies) {
            threads.push(this.pools.migrateTodayEntities.exec('migrateTodayEntities', [company.id, true]));
        }
        let results = await Promise.all(threads);
        this.finished.migrateTodayEntities = true;
    }
}



module.exports = FreightDragonMigrationTasks;