const OrderTask = require('./FreighDragonOrderTask');
const QuoteTask = require('./FreighDragonQuoteTask');
const MemberTask = require('./FreightDragonMemberTask');

orderTask = new OrderTask();
quoteTask = new QuoteTask();
memberTask = new MemberTask();

module.exports = {
    getMembersList: function(){
        memberTask.getList();
    },
    createQuotes: function(){
        quoteTask.createQuotes();
    },
    refreshQuote: function(){
        quoteTask.refreshQuotes();
    },
    quotesToOrders: function(){
        quoteTask.quotesToOrders();
    },
    refreshOrders: function(){
        orderTask.refreshOrders();
    },
    sendOrderNotes: function(){
        orderTask.sendOrderNotes();
    }
}