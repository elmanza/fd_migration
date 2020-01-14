const OrderTask = require('./FreighDragonOrderTask');
const QuoteTask = require('./FreighDragonQuoteTask');
const MemberTask = require('./FreightDragonMemberTask');

orderTask = new OrderTask();
quoteTask = new QuoteTask();
memberTask = new MemberTask();

module.exports = {
    getMembersList: function(){
        memberTask.getList().then(res => {
            console.log('getMembersList', res);
        })
        .catch(error =>{
            console.log('Error getMembersList', error);
        });
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
    }
}