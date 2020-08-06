require('dotenv').config();
module.exports = {
    batch_size: process.env.BATCH_SIZE || 50,
    defaultOperator: process.env.DEFAULT_OPERATOR || 'jeff@ritewayautotransport.com',
    defaultDispatcher: process.env.DEFAULT_DISTPACHER || 'jeff@ritewayautotransport.com',
}