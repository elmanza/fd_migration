const RiteWayHTTPService = require('../RiteWayHTTPService');
const fs = require('fs');
class InvoiceResource extends RiteWayHTTPService {
    constructor(){
        super();
        this.resourceUrl = '/invoice';
    }

    uploadInvoiceFile(invoiceId, fileData){
        let url = this.resourceUrl + `/${invoiceId}`;

        let formData = {
            invoiceFile: {
                value: fs.createReadStream(fileData.path),
                options: {
                    filename: fileData.name
                }
            }
        };

        return this.sendPutRequest(url, formData, true);
    }
}

module.exports = InvoiceResource;