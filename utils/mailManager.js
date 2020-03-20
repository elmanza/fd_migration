const { SESconfig } = require('../config/SESconfig');
const AWS = require('aws-sdk');

class MailManager {
    constructor() {
        this.AWS = new AWS.SES(SESconfig);
    }

    createParams(addresses, subject, htmlMessage) {
        const finalAddresses = Array.isArray(addresses) ? addresses : [addresses];
        const params = {
            Source: 'no-reply@lean-tech.io',
            Destination: {
                ToAddresses: finalAddresses
            },
            Message: {
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data: htmlMessage
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: subject
                }
            }
        };
        return params;
    }

    sendMail(addresses, subject, htmlMessage) {
        const params = this.createParams(addresses, subject, htmlMessage);
        return this.AWS.sendEmail(params).promise();
    }
}

module.exports = MailManager;
