const requestProm = require('request-promise');
const config = require("./config");

class FreightDragonService {
    constructor(){
        this.host = config.HOST;
    }

    getUrl(url){
        return this.host + url;
    }

    get(resourceUrl, data){
        let options = {
            method: "GET",
            uri: this.getUrl(resourceUrl),
            formData: data,
            json: true
        }
        return requestProm(options);
    }

    post(resourceUrl, data){
        let options = {
            method: "POST",
            uri: this.getUrl(resourceUrl),
            formData: data,
            json:true
        }
        return requestProm(options);
    }
}

module.exports = FreightDragonService;