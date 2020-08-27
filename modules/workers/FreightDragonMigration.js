

const moment = require('moment');
const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const RiteWayAutotransportSyncService = require('../rite_way/services/RiteWayAutotransportSyncService');
const FreightDragonService = require('../freight_dragon/services/FreightDragonService');

const { RiteWay, Stage } = require('../../models');

const RwSyncService = new RiteWayAutotransportSyncService();
const FDService = new FreightDragonService();

const Logger = require('../../utils/logger');

async function migrate(companyId, today = false) {
    let from = '2019-01-01';
    let to = moment().format('YYYY-MM-DD');

    let conditions = [
        Sequelize.where(
            Sequelize.col('FdCompanies.company_id'),
            '=',
            companyId
        )
    ];

    if (today) {
        from = moment().subtract(5, 'days').format('YYYY-MM-DD');
        conditions.push(
            Sequelize.where(
                Sequelize.col('MigratedCompany.migrated'),
                '=',
                true
            )
        );
    }
    else {
        conditions.push(
            Sequelize.where(
                Sequelize.col('MigratedCompany.id'),
                '=',
                null
            )
        );
    }

    let fdCompanies = await Stage.FdCompanies.findAll({
        include: [
            {
                model: Stage.MigratedCompany,
                require: false
            },
            {
                model: RiteWay.Company,
                include: {
                    model: RiteWay.CustomerDetail,
                    required: true,
                    as: 'customerDetail'
                }
            }
        ],
        where: {
            [sqOp.and]: conditions
        }
    });

    for (const fdCompany of fdCompanies) {
        let migration;
        let company = fdCompany.Company;

        if (fdCompany.MigratedCompany) {
            migration = fdCompany.MigratedCompany;
            migration = await migration.update({
                status: '',
                startedAt: moment().format('YYYY-MM-DD hh:mm:ss'),
                finishedAt: null
            });
        }
        else {
            migration = await Stage.MigratedCompany.create({
                fd_company_id: fdCompany.id,
                status: '',
                startedAt: moment().format('YYYY-MM-DD hh:mm:ss'),
                migrated: false
            });
        }

        let res = await FDService.getList(`${from} 00:00:00`, `${to} 23:59:59`, fdCompany.name.trim());
        let ok = 0;
        let fail = 0;
        let exists = 0;
        if (res.Success) {
            Logger.info(`Migration of ${fdCompany.name.trim()}. Total Entities: ${res.Data.length} Between ${from} to ${to}`);
            for (let [i, FDEntity] of res.Data.entries()) {
                let message = `Index ${i} FDOrderID ${FDEntity.FDOrderID} ${((i + 1) / res.Data.length * 100).toFixed(6)}%`;

                try {
                    let success = await RwSyncService.importFDEntity(FDEntity, company);
                    if (success) {
                        Logger.info(`Sucess import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${FDEntity.FDOrderID}`);
                        ok++;
                    }
                    else {
                        Logger.info(`Not imported  (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${FDEntity.FDOrderID}`);
                        exists++;
                    }
                }
                catch (e) {
                    Logger.error(`Error import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${FDEntity.FDOrderID}: ${e.message}`);
                    Logger.error(e);
                    fail++;
                }

                await migration.update({
                    status: message,
                    ok,
                    fail,
                    exists
                });
            }

            await migration.update({
                status: `Migration of ${fdCompany.name}. Total Entities: ${res.Data.length}. OK ${ok},  FAIL ${fail}`,
                finishedAt: moment().format('YYYY-MM-DD hh:mm:ss'),
                migrated: true
            });
        }

    }
}

async function migrateTodayEntities(companyId) {
    return migrate(companyId, true);
}

async function migrateOperators() {
    let res = await FDService.getMemberList();

    if (res.Success) {
        for (const fdOperator of res.Data) {
            let plainPassoword = Math.random().toString(36).slice(2);
            let name = fdOperator.contactname.split(' ');
            let userData = {
                name: name[0],
                last_name: name.slice(1).join(' '),
                username: fdOperator.email.trim().toLowerCase(),
                photo: '',
                phone: fdOperator.phone,
                company_id: null
            };

            let operatorUser = await RwSyncService.getUser(userData, plainPassoword);
        }
    }
}


module.exports = {
    migrate,
    migrateTodayEntities,
    migrateOperators
}