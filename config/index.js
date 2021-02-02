require('dotenv').config();

const FDConf = require('./FDConf');
const RWAConf = require('./RWAConf');
const { RiteWayDB } = require('./database');
const Storage = require('./storage');
const Debug = require('./debug');
const SyncConf = require('./sync_conf');
const s3 = require('./S3');

global.FDCredentialsAreWorking = true;

module.exports = {
    FDConf,
    RWAConf,
    RiteWayDB,
    Storage,
    Debug,
    SyncConf,
    s3
}