const {ritewayDB} = require('../../config/database');
const moment = require('moment');
const Debug = require('../../config/debug')
class Stage {
    cleanLogs(){
        let date = moment().subtract(Debug.daysLog, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        ritewayDB.query(`DELETE FROM stage.logs WHERE created_at < '${date}'`);
    }
}

module.exports = Stage;