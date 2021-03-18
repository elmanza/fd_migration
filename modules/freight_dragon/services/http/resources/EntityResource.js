const Resource = require('./Resource');

class EntityResource extends Resource {
    constructor(){
        super('entities/');
    }

    createQuote(data){        
        console.log("---------------------------------", data);
        return this.sendPostRequest('create_quote/', data);
    }

    quoteToOrder(data){
        console.log("DESDE quoteToOrder entity ---------------------------------", data);
        return this.sendPostRequest('quote_to_order/', data);
    }

    update(data){
        console.log("DESDE UPDATE ---------------------------------", data);
        return this.sendPostRequest('update/', data);
    }

    get(data){
        return this.sendGetRequest('', data);
    }

    getBatch(data){
        return this.sendGetRequest('batch/', data);
    }

    getList(data){
        return this.sendGetRequest('list/', data);
    }

    sendNotes(data){
        return this.sendPostRequest('add_notes/', data);
    }

    uploadDocument(FDOrderID, fileData){
        let formData = {
            FDOrderID,
            DOCUMENT: {
                value: fs.createReadStream(fileData.path),
                options: {
                    filename: fileData.name
                }
            }
        };
        return this.sendPostRequest('upload_file/', formData);
    }
}

module.exports = EntityResource;