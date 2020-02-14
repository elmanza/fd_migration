const RiteWayHTTPService = require('../../RiteWayHTTPService');

class Order extends RiteWayHTTPService {
    constructor(){
        this.resourceUrl = '/order';
    }

    uploadDocuments(orderId, file){
        let url = this.resourceUrl + `/${orderId}/uploadDocuments`;
        
        this.sendPostRequest(url);
    }
}

module.exports = Resource;