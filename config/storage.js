require('dotenv').config();
const path = require('path');
const fs = require('fs');

const downloadsPath = path.resolve(__dirname, '../downloads');

if (!fs.existsSync(downloadsPath)){
    fs.mkdirSync(downloadsPath);
}

module.exports = {
    DOWNLOADS_PATH: downloadsPath
};