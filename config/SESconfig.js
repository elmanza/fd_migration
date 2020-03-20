require('dotenv').config();

const SESconfig = {
    apiVersion: '2020-12-01',
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    region: process.env.AWS_SES_REGION,
}

module.exports = {
    SESconfig
};