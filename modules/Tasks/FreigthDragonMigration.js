require('dotenv').config();

const moment = require('moment');

const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;

const riteWay  = require("../../models/RiteWay/_riteWay");
const {ritewayDB} = require('../../config/database');

const StageQuote = require('../../models/Stage/quote');
const OperatorUser = require('../../models/Stage/operator_user');

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
        this.finishedProcess.getOperatorMembers = false;

        let res = await this.FDService.getMemberList();

        if(res.Success){

            let fdOperators = await res.Data;

            for(let i = 0; i<fdOperators.length; i++) {

                let fdOperator = fdOperators[i];
                let plainPassoword = Math.random().toString(36).slice(2);
                let newRWUser = false;

                let riteWayOperator = await riteWay.User.findOne({
                    where: {
                        username:fdOperator.email
                    }
                });

                //console.log(i, fdOperator.email, riteWayOperator==null);

                if(!riteWayOperator){                    

                    let name = fdOperator.contactname.split(' ');
                    let password = await Crypter.encryptPassword(plainPassoword);

                    riteWayOperator = await riteWay.User.create({
                        name: name[0],
                        last_name: name.slice(1).join(' '),
                        username: fdOperator.email,
                        password: password,
                        photo: '',
                        phone: fdOperator.phone,
                        shipper_type: '',
                        is_company_admin: false,
                        isOperator: true,
                        company_id: null
                    });  

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
        let companies = await riteWay.Company.findAll();

        let res = await this.FDService.getList(today+' 00:00:00', today+' 23:59:59');
        if(res.Success){
            for(let i=0; i<res.Data.length; i++){
                let fdEntity = res.Data[i];
                try{
                    let success = await this.RWService.importQuote(fdEntity);
                    if(success){
                        console.log("--->Sucess import ", i, fdEntity.FDOrderID)
                    }
                    else{
                        console.log("|Error import ", i, fdEntity.FDOrderID)
                    }
                }
                catch(e){
                    console.log("===========================================================================");
                    console.log( fdEntity.FDOrderID, e);
                    console.log("===========================================================================");
                }
            }
        }
        this.finishedProcess.getEntities = true;
    }

    async migration(){
        if(!this.finishedProcess.migration){

            return null;

        }
        console.log((new Date()).toString() + "getEntities task is called........................");
        
        this.finishedProcess.migration = false;
        let today = moment().format('YYYY-MM-DD');
        let companies = await riteWay.Company.findAll();

        for(let i = 0; i<companies.length; i++){
            let company =  companies[i];
            console.log("===========================================================================");
            console.log("company ", company.name);
            console.log("===========================================================================");
            let res = await this.FDService.getList('2010-01-01 00:00:00', today+' 23:59:59', company.name.trim());
            if(res.Success){
                for(let i=0; i<res.Data.length; i++){
                    let fdEntity = res.Data[i];
                    try{
                        let success = await this.RWService.importQuote(fdEntity, company);
                        if(success){
                            console.log("--->Sucess import ", i, (i/res.Data.length*100),fdEntity.FDOrderID)
                        }
                        else{
                            console.log("===>Error import ", i, (i/res.Data.length*100), fdEntity.FDOrderID)
                        }
                    }
                    catch(e){
                        console.log("===========================================================================");
                        console.log(e);
                        console.log("===========================================================================");
                    }
                    
                }
            }
        }
        this.finishedProcess.migration = false;
    }
}

module.exports = FreigthDragonMigration;