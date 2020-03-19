require('dotenv').config();

const cron = require('node-cron');
const tasks = require('./modules/Tasks/tasks');
const Stage = require('./modules/Tasks/Stage');
const cronTasks = {};

Object.keys(tasks).forEach(task =>{
    cronTasks[task] = cron.schedule(process.env.SCHEDULE, tasks[task]);
});

let stage = new Stage();
cronTasks['cleanLogs'] = cron.schedule('0 0 0 * * *', stage.cleanLogs);