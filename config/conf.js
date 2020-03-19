require('dotenv').config();
const FDConf = require('./FDConf');
const RWAConf = require('./RWAConf');
const {RiteWayDB} = require('./database');
const Storage = require('./storage');
const Debug = require('./debug');

module.exports = {
    FDConf,
    RWAConf,
    RiteWayDB,
    Storage,
    Debug
}