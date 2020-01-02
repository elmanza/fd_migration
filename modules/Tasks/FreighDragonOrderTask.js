
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
                        model: riteWay.Order
                    }
                ],
                where: {
                    id: stageQuote.riteWayId
                }
            });

            if(res.Success){
                for(let j=0; j < res.Data.length; j++) 
                {
                    let fdOrder = res.Data[j];
                    let fdStatus = this._parseStatus(fdOrder.status);

                    await riteWayQuote.order.update({
                        status: fdStatus
                    });

                    await riteWayQuote.stage_quote.update({
                        status: fdStatus
                    }); 
                    
                    sOrders.push(riteWayQuote.order.dataValues);
                };
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
            });
        });
    }
}

module.exports = FreighDragonOrderTask;