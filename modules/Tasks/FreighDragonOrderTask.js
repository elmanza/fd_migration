
require('dotenv').config();

const Sequelize = require('sequelize');
const OrderResource = require("../../services/FreightDragon/resources/order");
const RiteWayQuote = require("../../models/RiteWay/quote");
const RiteWayOrder = require("../../models/RiteWay/order");

class FreighDragonOrderTask{
    constructor(){
        this.orderResource = new OrderResource(process.env.ORDER_API_USER, process.env.ORDER_API_CODE);
    }

    createOrders(){
        
    }

    refreshOrders(){

    }
}

module.exports = FreighDragonOrderTask;