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
        this.finishedProcess.getEntities = false;
        let today = moment().format('YYYY-MM-DD');
        let res = await this.FDService.getList('2018-09-17 11:53:30', '2018-09-17 11:55:00');
        let company = await riteWay.Company.findByPk(1);

        if(res.Success){
            for(let i=0; i<res.Data.length; i++){
                let fdEntity = res.Data[i];
                try{
                    let success = await this.RWService.importQuote(fdEntity, company);
                    if(success){
                        console.log("Sucess migration ", fdEntity.FDOrderID)
                    }
                }
                catch(e){
                    console.log("===========================================================================");
                    console.log(e);
                    console.log("===========================================================================");
                }
                
            }
        }
        this.finishedProcess.getEntities = true;

        return res;

    }
}

module.exports = FreigthDragonMigration;