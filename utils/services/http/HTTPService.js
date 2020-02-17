
const requestProm = require('request-promise');
const Storage = require('../../../config/storage');
const util = require('util');

class HTTPService{
    constructor(){
    }

    static async getAndSendFile(fileData){
        try{
            fs.mkdirSync(Storage.DOWNLOADS_PATH + `/${fileData.folderName}`);
        }
        catch(e){}
        const fileUrl = fileData.origin;
        const file = fs.createWriteStream(Storage.DOWNLOADS_PATH + `/${fileData.folderName}/${fileData.name}`);

        let makeDownloadPromise = () => {
            return new Promise((resolve, reject)=>{
                https.get(fileUrl, response => {
                    console.log(response.headers);
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

        let downloaded = await makeDownloadPromise();
        console.log(downloaded);
        if(downloaded){
            
        }        
    }
}

module.exports = HTTPService;