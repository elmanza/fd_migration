
const requestProm = require('request-promise');
const Storage = require('../../../config/storage');
const util = require('util');
const https = require('https');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const Logger = require('../../logger');

class HTTPService{
    constructor(){
    }

    filterNulls(data){
        let dataWithoutNulls = {};

        Object.keys(data).forEach(key => {
            if(data[key] != null){
                dataWithoutNulls[key] = data[key];
            }
        });
        
        return dataWithoutNulls;
    }

    static async downloadFile(fileUrl, folderName, fileName){
        try{
            mkdirp.sync(Storage.DOWNLOADS_PATH + `/${folderName}`);
        }
        catch(e){
            Logger.error("Error download file");
            Logger.error(e);
            return false;
        }
        
        let filePath = Storage.DOWNLOADS_PATH + `/${folderName}/${fileName}`;
        const file = fs.createWriteStream(filePath);

        let makeDownloadPromise = () => {
            return new Promise((resolve, reject)=>{
                https.get(fileUrl, response => {
                    if(response.statusCode == 200 && response.headers['content-type'] != 'text/html'){
                        response.pipe(file).on('finish', () => resolve(filePath));
                        response.pipe(file).on('error', () => resolve(false));
                    }
                    else{
                        resolve(false);
                    }
                });
            });
        };
        return await makeDownloadPromise();    
    }
}

module.exports = HTTPService;