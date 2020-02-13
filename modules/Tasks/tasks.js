const RwFdSynchronize = require('./RwFdSynchronize');
const FreigthDragonMigration = require('./FreigthDragonMigration');

rw_fd_sync = new RwFdSynchronize();
migration = new FreigthDragonMigration();

module.exports = {
    createQuotes: function(){
        rw_fd_sync.createFDQuoteSyncTask();
    },
    refreshRWEntity: function(){
        rw_fd_sync.refreshRWEntitySyncTask();
    },
    quotesToOrders: function(){
        rw_fd_sync.quoteToOrderSyncTask();
    },
    sendOrderNotes: function(){
        rw_fd_sync.sendNotesSyncTask();
    },
    membersSync: function(){
        migration.getOperatorMembers();
    },
    /* importQuotes: function(){
        migration.getEntities();
    },     
    migrateAll: function(){
        migration.migration();
    }, */
}