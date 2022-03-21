const fs = require('fs');
const { promisify } = require('util');
const { s3 } = require('../config/index');
const Logger = require('./logger');

const uploadAWS = async (localPath, pathDestination) => {
    var params = {
        ACL: 'public-read',
        Bucket: 'riteway-customerportal-static',
        // Bucket: 'testritewaystatic-portal',
        Body: fs.createReadStream(localPath),
        Key: `uploads/${pathDestination}`
    };
    try {
        const upload = promisify(s3.upload.bind(s3));
        const data = await upload(params);

        return data;
    } catch (err) {
        Logger.error(`Error occured while trying to upload to S3 bucket ${err.message}`);
        Logger.error(err);
        throw err;
    }
}

module.exports = { uploadAWS };