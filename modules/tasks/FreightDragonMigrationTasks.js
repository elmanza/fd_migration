const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const SyncParameters = require('../../config/sync_conf');

const { RiteWay, Stage } = require('../../models');
const Logger = require('../../utils/logger');

const FDMigrationWorker = require('../workers/FreightDragonMigration');

class FreightDragonMigrationTasks {
    constructor() {
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
            // if(company.id == 118207){
            //     threads.push(FDMigrationWorker.migrate(company.id, false));
            // }            
            threads.push(FDMigrationWorker.migrate(company.id, false));
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
                        required: true
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
            threads.push( threads.push(FDMigrationWorker.migrateTodayEntities(company.id)));
        }
        let results = await Promise.all(threads);
        this.finished.migrateTodayEntities = true;
    }


    async migrateCustomeData() {
        try {
            let results = await Promise.all([FDMigrationWorker.migrateCustomeDataByFDNumbers()]);
        } catch (error) {
            console.log("ERROR EN migrateCustomeData", error);
        }
    }


    async migrateCarriers() {
        try {
            let results = await Promise.all([FDMigrationWorker.migrateCarriers()]);
        } catch (error) {
            console.log("ERROR EN migrateCustomeData", error);
        }
    }


    
}



module.exports = FreightDragonMigrationTasks;