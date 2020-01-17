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


    getUrl(actionUrl){
        return this.resourceUrl + (actionUrl||'');
    }

    doGetRequest(iData, actionUrl){
        let data = Object.assign({}, this.credentials, iData);
        return this.freightDragonService.get(this.getUrl(actionUrl), data);
    }

    doPostRequest(iData, actionUrl){
        let data = Object.assign({}, this.credentials, iData);   
        return this.freightDragonService.post(this.getUrl(actionUrl), data);
    }
    
}

module.exports = Resource;