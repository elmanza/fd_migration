const ResourceFreightDragon = require("../resource");
class Quote extends ResourceFreightDragon{
    constructor(apiUser, apiPasscode){
        super("LeanTech/entities", apiUser, apiPasscode, "OrderUpdate");
    }

    /* update(iData){
        let data = Object.assign({}, iData);

        return this.doPostRequest(data);
    } */

    get(iData){
        let data = Object.assign({}, iData);

        return this.doGetRequest(data);
    }
}

module.exports = Quote;