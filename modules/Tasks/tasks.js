const OrderTask = require('./FreighDragonOrderTask');
const QuoteTask = require('./FreighDragonQuoteTask');
const MemberTask = require('./FreightDragonMemberTask');

orderTask = new OrderTask();
quoteTask = new QuoteTask();
memberTask = new MemberTask();

module.exports = {
    /* getMembersList: function(){
        console.log("getMembersList task is called........................");
        memberTask.getList();
    }, */
    createQuotes: function(){
        console.log("createQuotes task is called........................");
        quoteTask.createQuotes();
    },/* 
    refreshQuote: function(){
        console.log("refreshQuote task is called........................");
        quoteTask.refreshQuotes();
    },
    quotesToOrders: function(){
        console.log("quotesToOrders task is called........................");
        quoteTask.quotesToOrders();
    },
    refreshOrders: function(){
        console.log("refreshOrders task is called........................");
        orderTask.refreshOrders();
    },
    sendOrderNotes: function(){
        console.log("sendOrderNotes task is called........................");
        orderTask.sendOrderNotes();
    } */
}