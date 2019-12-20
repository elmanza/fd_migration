const OrderTask = require('./FreighDragonOrderTask');
const QuoteTask = require('./FreighDragonQuoteTask');

orderTask = new OrderTask();
quoteTask = new QuoteTask();

module.exports = {
    createQuotes: function(){
        quoteTask.createQuotes();
    },
    refreshQuote: function(){
        quoteTask.refreshQuotes();
    },
    createOrders: function(){
        orderTask.createOrders();
    },
    refreshOrders: function(){
        orderTask.refreshOrders();
    }
}