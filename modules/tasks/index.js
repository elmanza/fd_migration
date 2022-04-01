const FreightDragonMigrationTasks = require('./FreightDragonMigrationTasks');
const RWSynchronizatorTasks = require('./RWSynchronizatorTasks');

const FDTasks = new FreightDragonMigrationTasks();
const RWTasks = new RWSynchronizatorTasks();

module.exports = {
    migrateCustomeData(){
        return FDTasks.migrateCustomeData();
    },
    migrateCarriers(){
        return FDTasks.migrateCarriers();
    },
    updateReferredCustomer(){
        return FDTasks.updateReferredCustomer();
    }, 
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
    createOrderFD(){
        return RWTasks.createOrderFD();
    },
    refreshDeliveredOrders(){
        return RWTasks.refreshDeliveredOrders();
    },
    syncInvoices(){
        return RWTasks.syncInvoices();
    },
    syncMyOrders(){
        return RWTasks.syncMyOrders();
    },
    syncDispatchSheet(){
        return RWTasks.syncDispatchSheet();
    },
    updateOrdersData(){
        return RWTasks.updateOrdersData();
    }  
}