const generateRiteWayModels = require('ritewayautotransport_database');
const { ritewayDB } = require('../../config/database');
module.exports = generateRiteWayModels(ritewayDB);