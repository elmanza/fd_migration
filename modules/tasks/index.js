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
    migrateLeads(){
        return FDTasks.migrateLeads();
    },
    migrateNotesLead(){
        return FDTasks.migrateNotesLead();
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
    syncInsertCompaniesWithoutCustomerDetails(){
        return RWTasks.syncInsertCompaniesWithoutCustomerDetails();
    },
    updateOrdersData(){
        return RWTasks.updateOrdersData();
    }  
}