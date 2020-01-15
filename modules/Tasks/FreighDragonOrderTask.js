
require('dotenv').config();

const moment = require('moment');
const Sequelize = require('sequelize');
const dbOp = Sequelize.Op;
const OrderResource = require("../../services/FreightDragon/resources/order");
const riteWay  = require("../../models/RiteWay/_riteWay");

const StageQuote = require('../../models/Stage/quote');

class FreighDragonOrderTask{
    constructor(){
        this.orderResource = new OrderResource(process.env.ORDER_API_USER, process.env.ORDER_API_CODE);
        
        this.finishedProcess = {
            refreshOrders:true,
        };
    }

    _parseStatus(status){
        let validStatus = ['active', 'onhold', 'cancelled', 'posted', 'notsigned', 'dispatched', 'issues', 'pickedup', 'delivered'];
        if(typeof validStatus[status-1] == 'undefined'){
            throw "Status not valid";
        }
        return validStatus[status-1];
    }

    async sendGetRequestToFD(stageQuotes){
        let sOrders = [];
        for(let i = 0; i<stageQuotes.length; i++){
            const stageQuote = stageQuotes[i];
            
            let res = await this.orderResource.get({
                FDOrderID: stageQuote.fdOrderId
            });

            let riteWayQuote = await riteWay.Quote.findOne({
                include: [
                    {
                        model: StageQuote,
                        as:'stage_quote'
                    },
                    {
                        model: riteWay.Order,
                        include: [
                            {
                                model: riteWay.Note
                            }
                        ]
                    }
                ],
                where: {
                    id: stageQuote.riteWayId
                },
                paranoid: false
            });

            if(res.Success){
                let fdOrder = res.Data;
                let fdStatus = this._parseStatus(fdOrder.status);
                
                if(riteWayQuote.order.status != 'issues'){
                    await riteWayQuote.order.update({
                        status: fdStatus
                    });
                }
                
                await riteWayQuote.stage_quote.update({
                    status: fdStatus,
                    fdResponse: "fd_get_order_success"
                }); 
                
                //Search if exist note
                let usersList = {};
                
                for(let iN=0; iN < fdOrder.notes.length; iN++){
                    let fdNote = fdOrder.notes[iN];
                    let rwUser = null;

                    if(typeof usersList[fdNote.email] == 'undefined'){
                        let user = await riteWay.User.findOne({
                            where: {
                                username: fdNote.email
                            }
                        });

                        if(user){
                            usersList[user.username] = user;
                            rwUser = usersList[user.username];
                        }
                    }
                    else{
                        rwUser = usersList[fdNote.email];
                    }
                    
                    if(rwUser != null){
                        let rwNote = await riteWay.Note.findOne({
                            where: {
                                [dbOp.and] : [
                                    Sequelize.where(
                                        Sequelize.col('notes.order_id'),
                                        '=',
                                        riteWayQuote.order.id
                                    ),
                                    Sequelize.where(
                                        Sequelize.col('notes.user_id'),
                                        '=',
                                        rwUser.id
                                    ),
                                    Sequelize.where(
                                        Sequelize.col('notes.created_at'),
                                        '=',
                                        fdNote.created
                                    ),
                                    Sequelize.where(
                                        Sequelize.col('notes.text'),
                                        'ilike',
                                        fdNote.text
                                    )
                                ]
                            }
                        });   
                        if(rwNote == null){
                            await riteWay.Note.create({
                                orderId: riteWayQuote.order.id,
                                userId: rwUser.id,
                                createdAt: fdNote.created,
                                updatedAt: fdNote.created,
                                text: fdNote.text
                            });
                        }                 
                    }
                }
                    
                sOrders.push(riteWayQuote.order.dataValues);
            }
            else{
                await riteWayQuote.stage_quote.update({
                    status: "fd_get_order_error",
                    fdResponse: JSON.stringify(res)
                });
            }
        }
        return sOrders;
    }

    refreshOrders(){
        if(!this.finishedProcess.refreshOrders){
            return null;
        }
        
        this.finishedProcess.refreshOrders = false;

        StageQuote.findAll({
            where: {
                'status': {
                    [dbOp.notIn]: ['waiting', 'offered']
                }
            }
        })
        .then( stageQuotes => {
            this.sendGetRequestToFD(stageQuotes)
            .then(result => {
                console.log("refreshOrders");
                console.log(result);
            })
            .catch(error => {
                console.log("refreshOrders Error");
                console.log(error);
            })
            .finally(()=>{
                this.finishedProcess.refreshOrders = true;
            });
        });
    }
}

module.exports = FreighDragonOrderTask;