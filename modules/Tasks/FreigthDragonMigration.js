require('dotenv').config();

const moment = require('moment');

const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;

const riteWay = require("../../models/RiteWay/_riteWay");
const { ritewayDB } = require('../../config/database');

const { FdCompanies, MigratedCompany, OperatorUser } = require('../../models/Stage/index');

const FreightDragonService = require('../../utils/services/FreightDragonService');
const RiteWayAutotranportService = require('../../utils/services/RiteWayAutotranportService');

const Crypter = require('../../utils/crypter');
const Logger = require('../../utils/logger');

class FreigthDragonMigration {
    constructor() {
        this.FDService = new FreightDragonService();
        this.RWService = new RiteWayAutotranportService();

        this.finishedProcess = {
            getOperatorMembers: true,
            getEntities: true,
            migration: true,
        };
    }

    async getOperatorMembers() {
        if (!this.finishedProcess.getOperatorMembers) {

            return null;

        }
        Logger.info((new Date()).toString() + "membersSync task is called.");
        this.finishedProcess.getOperatorMembers = false;

        let res = await this.FDService.getMemberList();

        if (res.Success) {

            let fdOperators = await res.Data;

            for (let i = 0; i < fdOperators.length; i++) {

                let fdOperator = fdOperators[i];
                let plainPassoword = Math.random().toString(36).slice(2);
                let newRWUser = false;

                let riteWayOperator = await riteWay.User.findOne({
                    where: Sequelize.where(
                        Sequelize.col('username'),
                        'ilike',
                        fdOperator.email.trim()
                    )
                });
                //Logger.info(`${fdOperator.email} is imported: ${riteWayOperator==null}`);

                if (!riteWayOperator) {

                    let name = fdOperator.contactname.split(' ');
                    let userData = {
                        name: name[0],
                        last_name: name.slice(1).join(' '),
                        username: fdOperator.email.trim().toLowerCase(),
                        photo: '',
                        phone: fdOperator.phone,
                        shipper_type: '',
                        is_company_admin: false,
                        isOperator: true,
                        company_id: null
                    };

                    riteWayOperator = await this.RWService.createUser(userData, plainPassoword);

                    newRWUser = true;
                }

                let stOperatorUser = await OperatorUser.findOne({
                    where: {
                        fdEmail: fdOperator.email.trim().toLowerCase()
                    }
                });

                if (!stOperatorUser) {
                    stOperatorUser = await OperatorUser.create({
                        riteWayId: riteWayOperator.id,
                        riteWayPass: newRWUser ? plainPassoword : "",
                        fdId: fdOperator.id,
                        fdUsername: fdOperator.username,
                        fdEmail: fdOperator.email.trim().toLowerCase(),
                    });
                }
                else {
                    stOperatorUser = await stOperatorUser.update({
                        riteWayId: riteWayOperator.id,
                        fdId: fdOperator.id,
                        fdUsername: fdOperator.username,
                        fdEmail: fdOperator.email.trim().toLowerCase(),
                    });
                }
            }
            res.Data = "Amount of operators: " + res.Data.length;
        }

        this.finishedProcess.getOperatorMembers = true;

        return res;

    }

    async getEntities() {
        if (!this.finishedProcess.getEntities) {

            return null;

        }
        Logger.info((new Date()).toString() + "getEntities task is called.");

        this.finishedProcess.getEntities = false;
        let today = moment().format('YYYY-MM-DD');
        let beforeToday = moment().subtract(5, 'days').format('YYYY-MM-DD');
        let fdCompanies = await FdCompanies.findAll({
            include: [
                {
                    model: MigratedCompany,
                    as: 'migrated_company',
                    require: false
                },
                {
                    model: riteWay.Company
                }
            ],
            where: {
                [dbOp.and]: [
                    Sequelize.where(
                        Sequelize.col('migrated_company.migrated'),
                        '=',
                        true
                    )
                ]
            }
        });

        for (let i = 0; i < fdCompanies.length; i++) {
            let fdCompany = fdCompanies[i];
            let res = await this.FDService.getList(beforeToday + ' 00:00:00', today + ' 23:59:59', fdCompany.company.name.trim());
            if (res.Success) {
                Logger.info((new Date()).toString() + " getEntities " + fdCompany.company.name.trim() + " Total Entities " + res.Data.length);
                for (let i = 0; i < res.Data.length; i++) {
                    let fdEntity = res.Data[i];
                    try {
                        let success = await this.RWService.importQuote(fdEntity, fdCompany.company);
                        if (success) {
                            Logger.info(`Sucess import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdEntity.FDOrderID}`);
                        }
                        else {
                            Logger.info(`Not imported  (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdEntity.FDOrderID}`);
                        }
                    }
                    catch (e) {
                        Logger.error(`Error import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdEntity.FDOrderID}: ${e.message}`);
                        Logger.error(e);
                    }

                }
            }
        }
        this.finishedProcess.getEntities = true;
    }

    async migration() {
        if (!this.finishedProcess.migration) {

            return null;

        }
        Logger.info((new Date()).toString() + "migration task is called.");

        this.finishedProcess.migration = false;
        let today = moment().format('YYYY-MM-DD');
        let fdCompanies = await FdCompanies.findAll({
            include: [
                {
                    model: MigratedCompany,
                    as: 'migrated_company',
                    require: false
                },
                {
                    model: riteWay.Company
                }
            ],
            where: {
                [dbOp.and]: [
                    Sequelize.where(
                        Sequelize.col('migrated_company.id'),
                        '=',
                        null
                    ),
                    Sequelize.where(
                        Sequelize.col('company.email'),
                        '!=',
                        'demo@ritewayautotransport.com'
                    )
                ]
            },
            limit: 1
        });

        for (let i = 0; i < fdCompanies.length; i++) {
            let fdCompany = fdCompanies[i];
            let migration = await MigratedCompany.create({
                fd_company_id: fdCompany.id,
                startedAt: moment().format('YYYY-MM-DD hh:mm:ss')
            });
            Logger.info("Migration of " + fdCompany.name);
            let res = await this.FDService.getList('2019-01-01 00:00:00', today + ' 23:59:59', fdCompany.name.trim());
            if (res.Success) {
                Logger.info("Total Entities " + res.Data.length);
                await migration.update({
                    status: "Total Entities " + res.Data.length
                });
                for (let i = 0; i < res.Data.length; i++) {
                    let fdEntity = res.Data[i];
                    let message = `Index ${i} FDOrderID ${fdEntity.FDOrderID} ${((i + 1) / res.Data.length * 100).toFixed(6)}%`;
                    try {
                        let success = await this.RWService.importQuote(fdEntity, fdCompany.company);
                        if (success) {
                            Logger.info(`Sucess import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdEntity.FDOrderID}`);
                        }
                        else {
                            Logger.info(`Not imported  (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdEntity.FDOrderID}`);
                        }
                    }
                    catch (e) {
                        Logger.error(`Error import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdEntity.FDOrderID}: ${e.message}`);
                        Logger.error(e);
                    }
                    await migration.update({
                        status: message
                    });

                }
            }
            await migration.update({
                finishedAt: moment().format('YYYY-MM-DD hh:mm:ss'),
                migrated: true
            });
            Logger.info("Migration of " + fdCompany.name + " finished " + moment().format('YYYY-MM-DD hh:mm:ss'));
        }
        this.finishedProcess.migration = true;
    }
}

module.exports = FreigthDragonMigration;