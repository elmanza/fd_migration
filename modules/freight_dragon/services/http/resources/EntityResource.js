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
    getCustomeData(data){
        return this.sendGetRequest('get_data_for_companies/', data);
    }
    syncMyOrders(data){
        return this.sendGetRequest('sync_my_orders/', data);
    }
    
    syncDispatchSheet(data){
        return this.sendGetRequest('sync_dispatch_sheet/', data);
    }

    updateOrdersData(data){
        return this.sendGetRequest('update_orders_data/', data);
    }

    getCarriers(data){
        return this.sendGetRequest('get_carriers/', data);
    }

    
}

module.exports = EntityResource;