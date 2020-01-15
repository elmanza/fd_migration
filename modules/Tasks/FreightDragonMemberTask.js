
require('dotenv').config();

const moment = require('moment');
const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;
const MemberResource = require("../../services/FreightDragon/resources/member");

const riteWay  = require("../../models/RiteWay/_riteWay");
const {ritewayDB} = require('../../config/database');

const OperatorUser = require('../../models/Stage/operator_user');

const Crypter = require('../../utils/crypter');

class FreightDragonMemberTask{
    constructor(){
        this.memberResource = new MemberResource(process.env.QUOTE_API_USER, process.env.QUOTE_API_CODE);
        this.finishedProcess = {
            getList:true,
        };
    }

    async getList(){
        if(!this.finishedProcess.getList){
            return null;
        }
        this.finishedProcess.getList = false;

        let res = await this.memberResource.list();
        if(res.Success){
            let fdOperators = await res.Data;
            for(let i = 0; i<fdOperators.length; i++) {
                let fdOperator = fdOperators[i];

                let riteWayOperator = await riteWay.User.findOne({
                    where: {
                        username:fdOperator.email
                    }
                });

                //console.log(i, fdOperator.email, riteWayOperator==null);

                if(riteWayOperator){
                    let operatorUser = await OperatorUser.findOne({
                        where: {
                            riteWayId: riteWayOperator.id
                        }
                    });
                    
                    if(!operatorUser){
                        let operatorUser = await OperatorUser.create({
                            riteWayId: riteWayOperator.id,
                            riteWayPass: "",
                            fdId: fdOperator.id,
                            fdUsername: fdOperator.username,
                            fdEmail: fdOperator.email,
                        });
                    }
                }
                else{
                    
                    let name = fdOperator.contactname.split(' ');
                    let plainPassoword = Math.random().toString(36).slice(2); 
                    let password = await Crypter.encryptPassword(plainPassoword);

                    let rwOperator = await riteWay.User.create({
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

                    let operatorUser = await OperatorUser.create({
                        riteWayId: rwOperator.id,
                        riteWayPass: plainPassoword,
                        fdId: fdOperator.id,
                        fdUsername: fdOperator.username,
                        fdEmail: fdOperator.email,
                    });   
                    
                    
                    
                }
            }
            res.Data = "Amount of operators: "+res.Data.length;
        }
        
        this.finishedProcess.getList = true;
        return res;
    }
}

module.exports = FreightDragonMemberTask;