const ResourceFreightDragon = require("../resource");
class Quote extends ResourceFreightDragon{
    constructor(apiUser, apiPasscode){
        super("LeanTech/entities", apiUser, apiPasscode, "LeadCreate");
    }

    create(iData){
        let data = Object.assign({}, iData);
        
        return this.doPostRequest(data, '/create_quote');
    }

    update(iData){
        let data = Object.assign({}, iData);

        return this.doPostRequest(data, '/update'); 
    }

    get(iData){
        let data = Object.assign({}, iData);

        return this.doGetRequest(data);
    }

    toOrder(iData){
        let data = Object.assign({}, iData);

        return this.doPostRequest(data, '/quote_to_order'); 
    }
}

module.exports = Quote;