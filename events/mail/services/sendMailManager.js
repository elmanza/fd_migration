const { SESconfig } = require('../../../configs/SESconfig');
const AWS = require('aws-sdk');
const { config } = require('../../../configs/config');
class SendMailManager {
    constructor() {
        this.AWS = new AWS.SES(SESconfig);
    }

    createParams(addresses, subject, htmlMessage, bccAddresses = []) {
        let finalAddresses = Array.isArray(addresses) ? addresses : [addresses];
        console.log("kjabdkjbqwkjbdkjasbjdk 000 " + subject);
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>> final recipents ", finalAddresses);
        if(config.dev) finalAddresses = config.supportEmails;
        console.log("kjabdkjbqwkjbdkjasbjdk 111 " + subject);
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>> final recipents ", finalAddresses);
        const params = {
            Source: 'no-reply@lean-tech.io',
            Destination: {
                BccAddresses: bccAddresses,
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

    sendMail(addresses, subject, htmlMessage, bccAddresses = [] ) {
        const params = this.createParams(addresses, subject, htmlMessage, bccAddresses);

        return this.AWS.sendEmail(params).promise();
    }
}

module.exports = new SendMailManager();
