const { RiteWay } = require('./models');
const RiteWayAutotransportSyncService = require('./modules/rite_way/services/RiteWayAutotransportSyncService');
const {
    broadcastEvent,
    buildBroadCastParams,
} = require('./events/eventManager');
const EVENT_TYPES = require('./events/event_types');

const RwSyncService = new RiteWayAutotransportSyncService();

(async function testSockets() {
    let quote = await RiteWay.Quote.findOne({ include: RwSyncService.quoteIncludeData(false), where: { id: 4593 }, paranoid: false, logging: true });

    RwSyncService.addToken(quote.Company.customerDetail.operatorUser);
    console.log('>>>>>>>>>>>>>>>>> USER', quote.Company.customerDetail.operatorUser.id, quote.Company.customerDetail.operatorUser.company_id);
    let eventType = EVENT_TYPES.orderStatusChange(quote);
    console.log('>>>>>>>>>>>>>>>>>>>>', eventType);
    const params = buildBroadCastParams(eventType, quote, quote.Company.customerDetail.operatorUser, { action: 'updated', element: 'Quote' }, "",
        {
            fd_number: quote.fd_number,
            quote_id: quote.id,
            newStatus: RwSyncService.statusToSymbol[quote.status_id],
            previousStatus: RwSyncService.statusToSymbol[quote.status_id],
            company_id: quote.company_id
        }
    );
    console.log(params);
    console.log('>>>>>>>>>>>>>>>>>>>>', params);
    await broadcastEvent(params);
})();