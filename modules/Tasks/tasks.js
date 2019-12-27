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
    quotesToOrders: function(){
        quoteTask.quotesToOrders();
    },
    refreshOrders: function(){
        orderTask.refreshOrders();
    }
}