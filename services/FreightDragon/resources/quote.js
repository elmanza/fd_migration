const ResourceFreightDragon = require("../resource");
class Quote extends ResourceFreightDragon{
    constructor(apiUser, apiPasscode){
        super("Leads.php", apiUser, apiPasscode, "LeadCreate");
    }

    create(iData){
        let data = Object.assign({
            Action: "Create"
        }, iData);
        
        return this.doPostRequest(data);
    }

    get(iData){
        let data = Object.assign({
            Action: "Get"
        }, iData);

        return this.doPostRequest(data);
    }

    toOrder(iData){
        let data = Object.assign({
            Action: "ToOrder"
        }, iData);

        return this.doPostRequest(data); 
    }
}

module.exports = Quote;