const Resource = require('./Resource');

class MemberResource extends Resource {
    constructor(){
        super('members/');
    }

    get(email){
        return this.sendGetRequest('', {
            email
        });
    }

    getList(){
        return this.sendGetRequest('list');
    }
}

module.exports = MemberResource;