require('dotenv').config();

const cron = require('node-cron');
const tasks = require('./modules/Tasks/tasks');
const cronTasks = {};

Object.keys(tasks).forEach(task =>{
    cronTasks[task] = cron.schedule(process.env.SCHEDULE, tasks[task]);
})
