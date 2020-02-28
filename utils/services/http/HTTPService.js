
const requestProm = require('request-promise');
const Storage = require('../../../config/storage');
const util = require('util');
const https = require('https');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

class HTTPService{
    constructor(){
    }

    static async downloadFile(fileUrl, folderName, fileName){
        try{
            mkdirp.sync(Storage.DOWNLOADS_PATH + `/${folderName}`);
        }
        catch(e){
            console.log("Error download file", e)
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