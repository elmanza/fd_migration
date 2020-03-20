const {ritewayDB} = require('../../config/database');
const moment = require('moment');
const Debug = require('../../config/debug');
const reports = require('../../resources/email_templates/reports');
const MailManager = require('../../utils/mailManager');
class Stage {
    constructor(){
        this.mailManager = new MailManager();
    }

    cleanLogs(){
        let date = moment().subtract(Debug.daysLog, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        ritewayDB.query(`DELETE FROM stage.logs WHERE created_at < '${date}'`);
    }

    async sendErrorReport(){
        const datetime = moment().subtract(1, 'hours').format('YYYY-MM-DD HH:mm:ss');
        const sql = `select * from stage.logs where date_trunc('hour', created_at) = date_trunc('hour', '${datetime}'::timestamp ) and "level" = 'error'`;
        const records = await ritewayDB.query(sql, { type: ritewayDB.QueryTypes.SELECT});
        
        if(records.length > 0){
            const htmlBody = reports.errorReportHtml(datetime, records);
            return this.mailManager.sendMail(['hgallardo@lean-tech.io'], 'Sync Process Error Report', htmlBody);
        }
    }
}

module.exports = Stage;