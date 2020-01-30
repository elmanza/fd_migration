
const requestProm = require('request-promise');
const FDConf = require('../../../config/FDConf');

class FreightDragonHTTPServices{
    constructor(){
        this.host = FDConf.apiUrl;
        this.credentials = FDConf.credentials
    }

    getDataWCredentials(data){
        return {...this.credentials, ...data};
    }

    getUrl(url){
        return this.host + url;
    }

    sendGetRequest(resourceUrl, data = {}){
        let options = {
            method: "GET",
            uri: this.getUrl(resourceUrl),
            qs: this.getDataWCredentials(data),
            //formData: data,
            json: true
        }
        return requestProm(options);
    }

    sendPostRequest(resourceUrl, data = {}){
        let options = {
            method: "POST",
            uri: this.getUrl(resourceUrl),
            formData: this.getDataWCredentials(data),
            json:true
        }
        return requestProm(options);
    }
}

module.exports = FreightDragonHTTPServices;