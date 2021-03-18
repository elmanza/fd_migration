
const requestProm = require('request-promise');
const { FDConf, SyncConf } = require('../../../../config');
const HTTPService = require('../../../../utils/HTTPService');
const MailManager = require('../../../../utils/mailManager');

class FreightDragonHTTPServices extends HTTPService {
    constructor() {
        super();
        this.host = FDConf.apiUrl;
        this.credentials = FDConf.credentials;
        this.InvalidCredentialsMsg = 'Invalid Access Credentials';
        this.mailManager = new MailManager();
    }

    getDataWCredentials(data) {
        return { ...this.credentials, ...this.filterNulls(data) };
    }

    getUrl(url) {
        return this.host + url;
    }

    async sendGetRequest(resourceUrl, data = {}) {
        let options = {
            method: "GET",
            uri: this.getUrl(resourceUrl),
            qs: this.getDataWCredentials(data),
            //formData: data,
            json: true
        }
        const response = await requestProm(options);

        if (!response.Success && response.Message == this.InvalidCredentialsMsg && FDCredentialsAreWorking) {
            FDCredentialsAreWorking = false;
            this.mailManager.sendMail(SyncConf.supportEmails, 'FD API Credentials', 'FD API Credentials was deactivated');
        }

        return response;
    }

    async sendPostRequest(resourceUrl, data = {}) {
        let options = {
            method: "POST",
            uri: this.getUrl(resourceUrl),
            formData: this.getDataWCredentials(data),
            json: true
        }
        console.log(options);
        const response = await requestProm(options);

        if (response.Success && !FDCredentialsAreWorking) {
            FDCredentialsAreWorking = true;
        }
        console.log("DESDE sendPostRequest CONSOLE DE formData: ", options.formData);
        return requestProm(options);
    }
}

module.exports = FreightDragonHTTPServices;