const FreightDragonHttpService = require('../../FreightDragonHTTPService');

class Resource extends FreightDragonHttpService {
    constructor(urlResource){
        super();
        this.resourceUrl = urlResource;
    }

    getUrl(url){
        return this.host + this.resourceUrl + url;
    }
}

module.exports = Resource;