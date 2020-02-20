
const requestProm = require('request-promise');
const Storage = require('../../../config/storage');
const util = require('util');

class HTTPService{
    constructor(){
    }

    static async downloadFile(fileUrl, folderName, fileName){
        try{
            fs.mkdirSync(Storage.DOWNLOADS_PATH + `/${folderName}`);
        }
        catch(e){
            return false;
        }
        
        let filePath = Storage.DOWNLOADS_PATH + `/${folderName}/${fileName}`;
        const file = fs.createWriteStream(filePath);

        let makeDownloadPromise = () => {
            return new Promise((resolve, reject)=>{
                https.get(fileUrl, response => {
                    if(response.statusCode == 200 && response.headers['content-type'] != 'text/html'){
                        response.pipe(file).on('finish', () => resolve(true));
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