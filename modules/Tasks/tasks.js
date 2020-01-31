const RwFdSynchronize = require('./RwFdSynchronize');
const FreigthDragonMigration = require('./FreigthDragonMigration');

rw_fd_sync = new RwFdSynchronize();
migration = new FreigthDragonMigration();

module.exports = {
    createQuotes: function(){
        console.log((new Date()).toString() + "createQuotes task is called........................");
        rw_fd_sync.createFDQuoteSyncTask();
    },
    refreshRWEntity: function(){
        console.log((new Date()).toString() + "refreshRWEntity task is called........................");
        rw_fd_sync.refreshRWEntitySyncTask();
    },
    quotesToOrders: function(){
        console.log((new Date()).toString() + "quotesToOrders task is called........................");
        rw_fd_sync.quoteToOrderSyncTask();
    },
    sendOrderNotes: function(){
        console.log((new Date()).toString() + "sendOrderNotes task is called........................");
        rw_fd_sync.sendNotesSyncTask();
    },
    membersSync: function(){
        console.log((new Date()).toString() + "membersSync task is called........................");
        migration.getOperatorMembers();
    },
    /*importQuotes: function(){
        migration.getEntities();
    },
    
    migrateAll: function(){
        migration.migration();
    },*/
}