const ResourceFreightDragon = require("../resource");
class Member extends ResourceFreightDragon{
    constructor(apiUser, apiPasscode){
        super("LeanTech/members", apiUser, apiPasscode, "LeadCreate");
    }

    get(iData){
        let data = Object.assign({}, iData);

        return this.doGetRequest(data);
    }

    list(iData){
        let data = Object.assign({}, iData);

        return this.doGetRequest(data, '/list');
    }
}

module.exports = Member;