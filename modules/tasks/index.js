const FreightDragonMigrationTasks = require('./FreightDragonMigrationTasks');
const RWSynchronizatorTasks = require('./RWSynchronizatorTasks');

const FDTasks = new FreightDragonMigrationTasks();
const RWTasks = new RWSynchronizatorTasks();

module.exports = {
    migrate(){
        return FDTasks.migrateAll();
    },
    migrateTodayEntities(){
        return FDTasks.migrateTodayEntities();
    },
    createQuote(){
        return RWTasks.createQuote();
    },
    quoteToOrder(){
        return RWTasks.quoteToOrder();
    },
    refreshQuotes(){
        return RWTasks.refreshQuotes();
    },
    refreshOrders(){
        return RWTasks.refreshOrders();
    },
    refreshDeliveredOrders(){
        return RWTasks.refreshDeliveredOrders();
    },
    syncInvoices(){
        return RWTasks.syncInvoices();
    }
}