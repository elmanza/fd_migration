require('dotenv').config();

//SOCKETS
const { RWAConf, SyncConf } = require('./config');
const io = require('socket.io-client');
const NotificationsClient = require('./events/clients/notificationsClient');
const UpdateComponentClient = require('./events/clients/updateComponentClient');
const { RiteWay } = require('./models');
const RiteWayAutotransportSyncService = require('./modules/rite_way/services/RiteWayAutotransportSyncService');
let updateComponent;
let notifications;

(async function startSockets() {
    const RwSyncService = new RiteWayAutotransportSyncService();

    let user = await RiteWay.User.findOne({
        username: RWAConf.credentials.username
    });

    RwSyncService.addToken(user);

    updateComponent = new UpdateComponentClient(io, user.token);
    updateComponent.startSocket();

    notifications = new NotificationsClient(io, user.token);
    notifications.startSocket();
})();

//CRON JOBS
const cron = require('node-cron');
const tasks = require('./modules/tasks');

const cronTasks = {};


cron.schedule(SyncConf.SCHEDULE.MIGRATION, tasks.migrateCustomeData);
// cron.schedule(SyncConf.SCHEDULE.MIGRATION, tasks.migrate);
// cron.schedule(SyncConf.SCHEDULE.MIGRATION, tasks.migrateTodayEntities);

// cron.schedule(SyncConf.SCHEDULE.GENERAL, tasks.createQuote);

// cron.schedule(SyncConf.SCHEDULE.GENERAL, tasks.quoteToOrder);

// cron.schedule(SyncConf.SCHEDULE.REFRESH_QUOTES, tasks.refreshQuotes);
// cron.schedule(SyncConf.SCHEDULE.REFRESH_ORDERS, tasks.refreshOrders);

// cron.schedule(SyncConf.SCHEDULE.REFRESH_DELIVERED_ORDERS, tasks.refreshDeliveredOrders);


// cron.schedule(SyncConf.SCHEDULE.GENERAL, tasks.syncInvoices);

// cron.schedule(SyncConf.SCHEDULE.GENERAL, tasks.syncMyOrders);

// cron.schedule(SyncConf.SCHEDULE.GENERAL, tasks.syncDispatchSheet);


// cron.schedule(SyncConf.SCHEDULE.GENERAL, tasks.updateOrdersData);



// cron.schedule(SyncConf.SCHEDULE.REFRESH_ORDERS, tasks.createOrderFD);

// cron.schedule(SyncConf.SCHEDULE.REFRESH_ORDERS, tasks.createOrderFD);


// cron.schedule(SyncConf.SCHEDULE.MIGRATION, tasks.migrateCarriers);

// cron.schedule(SyncConf.SCHEDULE.MIGRATION, tasks.updateReferredCustomer);
//TEST SOCKETS
//require('./test_sockets');