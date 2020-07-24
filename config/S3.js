require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.setPromisesDependency();
AWS.config.update({
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    region: process.env.AWS_S3_REGION
});
const s3 = new AWS.S3();



module.exports = s3;
