const Resource = require('./Resource');

class EntityResource extends Resource {
    constructor(){
        super('entities/');
    }

    createQuote(data){        
        return this.sendPostRequest('create_quote/', data);
    }

    quoteToOrder(data){
        return this.sendPostRequest('quote_to_order/', data);
    }

    update(data){
        return this.sendPostRequest('update/', data);
    }

    get(data){
        return this.sendGetRequest('', data);
    }

    getList(data){
        return this.sendGetRequest('list/', data);
    }

    sendNotes(data){
        return this.sendPostRequest('add_notes/', data);
    }
}

module.exports = EntityResource;