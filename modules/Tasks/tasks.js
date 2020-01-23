const OrderTask = require('./FreighDragonOrderTask');
const QuoteTask = require('./FreighDragonQuoteTask');
const MemberTask = require('./FreightDragonMemberTask');

orderTask = new OrderTask();
quoteTask = new QuoteTask();
memberTask = new MemberTask();

module.exports = {
    /* getMembersList: function(){
        console.log((new Date()).toString() + "getMembersList task is called........................");
        memberTask.getList();
    }, */
    createQuotes: function(){
        console.log((new Date()).toString() + "createQuotes task is called........................");
        quoteTask.createQuotes();
    },/* 
    refreshQuote: function(){
        console.log((new Date()).toString() + "refreshQuote task is called........................");
        quoteTask.refreshQuotes();
    },
    quotesToOrders: function(){
        console.log((new Date()).toString() + "quotesToOrders task is called........................");
        quoteTask.quotesToOrders();
    },
    refreshOrders: function(){
        console.log((new Date()).toString() + "refreshOrders task is called........................");
        orderTask.refreshOrders();
    },
    sendOrderNotes: function(){
        console.log((new Date()).toString() + "sendOrderNotes task is called........................");
        orderTask.sendOrderNotes();
    } */
}