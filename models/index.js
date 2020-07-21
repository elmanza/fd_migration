const { ritewayDB } = require('../config/database');

const RiteWay = require('./RiteWay');
const { initializeModels: generateStageModels } = require('./Stage');


const Stage = generateStageModels(ritewayDB, RiteWay);

module.exports = {
    RiteWay,
    Stage
};