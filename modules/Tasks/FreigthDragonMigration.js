require('dotenv').config();

const moment = require('moment');

const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;

const riteWay  = require("../../models/RiteWay/_riteWay");
const {ritewayDB} = require('../../config/database');

const StageQuote = require('../../models/Stage/quote');
const OperatorUser = require('../../models/Stage/operator_user');
const MigratedCompany = require('../../models/Stage/migrated_company');

const FreightDragonService = require('../../utils/services/FreightDragonService');
const RiteWayAutotranportService = require('../../utils/services/RiteWayAutotranportService');

const Crypter = require('../../utils/crypter');

class FreigthDragonMigration {
    constructor(){
        this.FDService = new FreightDragonService();
        this.RWService = new RiteWayAutotranportService();

        this.finishedProcess = {
            getOperatorMembers:true,
            getEntities:true,
            migration:true,
        };
    }

    async getOperatorMembers(){
        if(!this.finishedProcess.getOperatorMembers){

            return null;

        }
        console.log((new Date()).toString() + "membersSync task is called........................");
        this.finishedProcess.getOperatorMembers = false;

        let res = await this.FDService.getMemberList();

        if(res.Success){

            let fdOperators = await res.Data;

            for(let i = 0; i<fdOperators.length; i++) {

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

                //console.log(i, fdOperator.email, riteWayOperator==null);

                if(!riteWayOperator){                    

                    let name = fdOperator.contactname.split(' ');
                    let userData = {
                        name: name[0],
                        last_name: name.slice(1).join(' '),
                        username: fdOperator.email,
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
                        fdEmail: fdOperator.email
                    }
                });              

                if(!stOperatorUser){
                    stOperatorUser = await OperatorUser.create({
                        riteWayId: riteWayOperator.id,
                        riteWayPass: newRWUser ? plainPassoword : "",
                        fdId: fdOperator.id,
                        fdUsername: fdOperator.username,
                        fdEmail: fdOperator.email,
                    });
                }
                else{
                    stOperatorUser = await stOperatorUser.update({
                        riteWayId: riteWayOperator.id,
                        fdId: fdOperator.id,
                        fdUsername: fdOperator.username,
                        fdEmail: fdOperator.email,
                    });
                }
            }
            res.Data = "Amount of operators: "+res.Data.length;
        }       

        this.finishedProcess.getOperatorMembers = true;

        return res;

    }

    async getEntities(){
        if(!this.finishedProcess.getEntities){

            return null;

        }
        console.log((new Date()).toString() + "getEntities task is called........................");
        
        this.finishedProcess.getEntities = false;
        let today = moment().format('YYYY-MM-DD');
        let companies = await riteWay.Company.findAll({
            include: {
                model: MigratedCompany,
                as: 'migrated_company',
                require: true
            },
            where: {
                [dbOp.and] : [
                    Sequelize.where(
                        Sequelize.col('migrated_company.migrated'),
                        '=',
                        true
                    )
                ]
            }
        });

        for(let i = 0; i<companies.length; i++){
            let company =  companies[i];
            let res = await this.FDService.getList(today+' 00:00:00', today+' 23:59:59', company.name.trim());
            if(res.Success){
                console.log((new Date()).toString() ,"getEntities Total Entities ", res.Data.length);
                for(let i=0; i<res.Data.length; i++){
                    let fdEntity = res.Data[i];
                    try{
                        let success = await this.RWService.importQuote(fdEntity, company);
                        if(success){
                            console.log(`--->Sucess import (${((i+1)/res.Data.length*100).toFixed(6)}%)`, i, fdEntity.FDOrderID);
                        }
                        else{
                            console.log(`--->Not imported  (${((i+1)/res.Data.length*100).toFixed(6)}%)`, i, fdEntity.FDOrderID);
                        }
                    }
                    catch(e){
                        console.log("===========================================================================");
                        console.log(`--->Error import (${((i+1)/res.Data.length*100).toFixed(6)}%)`, i, fdEntity.FDOrderID, e);
                        console.log("===========================================================================");
                    }
                    
                }
            }
        }
        this.finishedProcess.getEntities = true;
    }

    async migration(){
        if(!this.finishedProcess.migration){

            return null;

        }
        console.log((new Date()).toString() + "migration task is called........................");
        
        this.finishedProcess.migration = false;
        let today = moment().format('YYYY-MM-DD');
        let companies = await riteWay.Company.findAll({
            include: {
                model: MigratedCompany,
                as: 'migrated_company',
                require: false
            },
            where: {
                [dbOp.and] : [
                    Sequelize.where(
                        Sequelize.col('migrated_company.id'),
                        '=',
                        null
                    ),
                    Sequelize.where(
                        Sequelize.col('companies.email'),
                        '!=',
                        'demo@ritewayautotransport.com'
                    )
                ]
            }
        });

        for(let i = 0; i<companies.length; i++){
            let company =  companies[i];
            let migration = await MigratedCompany.create({
                fd_company_id: company.id, 
                startedAt: moment().format('YYYY-MM-DD hh:mm:ss')
            });

            console.log("===========================================================================");
            console.log("Migrate company ", company.name, moment().format('YYYY-MM-DD hh:mm:ss'));
            console.log("===========================================================================");
            let res = await this.FDService.getList('2019-01-01 00:00:00', today+' 23:59:59', company.name.trim());
            if(res.Success){
                console.log("Total Entities ", res.Data.length, "-------------");
                for(let i=0; i<res.Data.length; i++){
                    let fdEntity = res.Data[i];
                    let message = `Index ${i} FDOrderID ${fdEntity.FDOrderID} ${((i+1)/res.Data.length*100).toFixed(6)}%`;
                    try{
                        let success = await this.RWService.importQuote(fdEntity, company);
                        if(success){
                            console.log(`--->Sucess import (${((i+1)/res.Data.length*100).toFixed(6)}%)`, i, fdEntity.FDOrderID);
                        }
                        else{
                            console.log(`--->Not imported  (${((i+1)/res.Data.length*100).toFixed(6)}%)`, i, fdEntity.FDOrderID);
                        }
                    }
                    catch(e){
                        console.log("===========================================================================");
                        console.log(`--->Error import (${((i+1)/res.Data.length*100).toFixed(6)}%)`, i, fdEntity.FDOrderID, e);
                        console.log("===========================================================================");
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
            console.log("finished ", moment().format('YYYY-MM-DD hh:mm:ss'));
        }
        this.finishedProcess.migration = true;
    }
}

module.exports = FreigthDragonMigration;