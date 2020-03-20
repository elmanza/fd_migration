const Logger = {};
const moment = require('moment')
const {level, storage} = require('../config/conf').Debug;
const {Log} = require('../models/Stage/index');

Logger.debugLevel = level;
Logger.debugStorage = storage;

Logger.log = (level, message) => {
    let levels = ['debug', 'info', 'warn', 'error'];
    let strMessage = message;
    if (levels.indexOf(level) <= levels.indexOf(Logger.debugLevel) ) {
        if (typeof message !== 'string') {
            if(message instanceof Error){
                strMessage = message.stack;
            }
            else{
                strMessage = JSON.stringify(message);
            }
        };
        
        if(Logger.debugStorage == 'DATABASE'){
            Log.create({
                level,
                message: strMessage,
                createdAt: moment().format('YYYY-MM-DD hh:mm:ss')
            });
        }
        else{
            console[level](strMessage);
        }
      }
}

Logger.info = (message) => {
    Logger.log('info', message);
}

Logger.warn = (message) => {
    Logger.log('warn', message);
}

Logger.error = (message) => {
    Logger.log('error', message);
}

Logger.debug = (message) => {
    Logger.log('debug', message);
}

module.exports = Logger;