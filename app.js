require('dotenv').config();

//SOCKETS
const { RWAConf } = require('./config');
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

Object.keys(tasks).forEach(task => {
    cronTasks[task] = cron.schedule(process.env.SCHEDULE, tasks[task]);
});


//TEST SOCKETS
//require('./test_sockets');