require('dotenv').config();
module.exports = {
    batch_size: process.env.BATCH_SIZE || 50,
    defaultOperator: process.env.DEFAULT_OPERATOR || 'jeff@ritewayautotransport.com',
    defaultDispatcher: process.env.DEFAULT_DISTPACHER || 'jeff@ritewayautotransport.com',
    SCHEDULE: {
        GENERAL: process.env.GENERAL_SCHEDULE,
        MIGRATION: process.env.MIGRATION_SCHEDULE,
        REFRESH_QUOTES: process.env.REFRESH_QUOTES_SCHEDULE,
        REFRESH_ORDERS: process.env.REFRESH_ORDERS_SCHEDULE,
        REFRESH_DELIVERED_ORDERS: process.env.REFRESH_DELIVERED_SCHEDULE,
    }
}