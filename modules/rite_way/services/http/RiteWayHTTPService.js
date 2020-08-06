
const requestProm = require('request-promise');
const { RWAConf } = require('../../../../config');
const HTTPService = require('../../../../utils/HTTPService');

class RiteWayHTTPService extends HTTPService {
    constructor() {
        super();
        this.host = RWAConf.host;
        this.credentials = RWAConf.credentials
    }

    getUrl(url) {
        return this.host + url;
    }

    async addToken(options) {

        let authOptions = {
            method: "POST",
            uri: this.getUrl('/auth/login'),
            body: this.credentials,
            json: true
        }
        let tokenData = await requestProm(authOptions);
        if (typeof options.headers == 'undefined') {
            options.headers = {};
        }
        options.headers['Authorization'] = `${tokenData.type} ${tokenData.token}`;
    }

    async sendGetRequest(resourceUrl, data = {}, doLoggin) {
        let options = {
            method: "GET",
            uri: this.getUrl(resourceUrl),
            qs: data,
            json: true
        }

        if (doLoggin) {
            await this.addToken(options);
        }

        return await requestProm(options);
    }

    async sendPostRequest(resourceUrl, data = {}, doLoggin) {
        let options = {
            method: "POST",
            uri: this.getUrl(resourceUrl),
            formData: this.filterNulls(data),
            json: true
        };

        if (doLoggin) {
            await this.addToken(options);
        }

        return await requestProm(options);
    }

    async sendPutRequest(resourceUrl, data = {}, doLoggin) {
        let options = {
            method: "PUT",
            uri: this.getUrl(resourceUrl),
            formData: this.filterNulls(data),
            json: true
        };

        if (doLoggin) {
            await this.addToken(options);
        }

        return await requestProm(options);
    }
}

module.exports = RiteWayHTTPService;