const ResourceFreightDragon = require("../resource");
class Quote extends ResourceFreightDragon{
    constructor(apiUser, apiPasscode){
        super("Orders.php", apiUser, apiPasscode, "OrderUpdate");
    }

    update(iData){
        let data = Object.assign({
            Action: "Update"
        }, iData);

        return this.doPostRequest(data);
    }

    get(iData){
        let data = Object.assign({
            Action: "Get"
        }, iData);

        return this.doPostRequest(data);
    }
}

module.exports = Quote;