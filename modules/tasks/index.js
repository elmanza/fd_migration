const FreightDragonMigrationTasks = require('./FreightDragonMigrationTasks');
const RWSynchronizatorTasks = require('./RWSynchronizatorTasks');

FDTasks = new FreightDragonMigrationTasks();
RWTasks = new RWSynchronizatorTasks();

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
    }
}