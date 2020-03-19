require('dotenv').config();

module.exports = {
    level: process.env.DEBUG_LEVEL || 'info',
    storage: process.env.DEBUG_STORAGE || 'CONSOLE',
    daysLog: process.env.DEBUG_DAYS_LOG || 0
}