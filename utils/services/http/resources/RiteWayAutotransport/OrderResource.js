const RiteWayHTTPService = require('../../RiteWayHTTPService');
const fs = require('fs');
class OrderResource extends RiteWayHTTPService {
    constructor(){
        super();
        this.resourceUrl = '/order';
    }

    uploadDocument(orderId, fileData){
        let url = this.resourceUrl + `/${orderId}/uploadDocuments`;

        let formData = {
            orderDocuments: {
                value: fs.createReadStream(fileData.path),
                options: {
                    filename: fileData.name
                }
            }
        };

        return this.sendPostRequest(url, formData, true);
    }

    uploadBOL(orderId, fileData){
        let url = this.resourceUrl + `/${orderId}`;

        let formData = {
            bol: {
                value: fs.createReadStream(fileData.path),
                options: {
                    filename: fileData.name
                }
            }
        };

        return this.sendPostRequest(url, formData, true);
    }
}

module.exports = OrderResource;