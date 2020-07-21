const { RiteWay } = require('./models');
const RiteWayAutotransportSyncService = require('./modules/rite_way/services/RiteWayAutotransportService');
const FreightDragonService = require('./modules/freight_dragon/services/FreightDragonService');
const requestPromise = require('request-promise');


const RwSyncService = new RiteWayAutotransportSyncService();
const FDService = new FreightDragonService();


(async function test() {
    /* let quotes = await RwSyncService.getWatchedQuotes(0, 1);

    for (quote of quotes) {
        console.log(FDService.parseRWData(quote))
        let FDResponse = await FDService.get(quote.fd_number);

        if (FDResponse.Success) {
            let FDEntity = FDResponse.Data;
            let rwEntity = await RwSyncService.parseFDEntity(FDEntity);

            console.log(rwEntity);

        }

    } */

    await RiteWay.Order.findOne();
})();