const Resource = require('./Resource');

class EntityResource extends Resource {
    constructor(){
        super('entities/');
    }

    createQuote(data){        
        return this.sendPostRequest('create_quote/', data);
    }

    quoteToOrder(iData){
        return this.sendPostRequest('quote_to_order/', data);
    }

    update(data){
        return this.sendPostRequest('update/', data);
    }

    get(data){
        return this.sendGetRequest('', data);
    }   
}

module.exports = EntityResource;