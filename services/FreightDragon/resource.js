const FreightDragonService = require("./freightDragonService");

class Resource {
    constructor(resourceUrl, apiUser, apiPasscode, apiCode){
        this.resourceUrl = resourceUrl;
        this.credentials = {};
        this.credentials.APIUser = apiUser;
        this.credentials.APIPasscode = apiPasscode;
        this.credentials.APICode = apiCode;
        this.freightDragonService = new FreightDragonService()
    }

    doGetRequest(iData){
        let data = Object.assign({}, this.credentials, iData);
        return this.freightDragonService.get(this.resourceUrl, data);
    }

    doPostRequest(iData){
        let data = Object.assign({}, this.credentials, iData);        
        return this.freightDragonService.post(this.resourceUrl, data);
    }
    
}

module.exports = Resource;