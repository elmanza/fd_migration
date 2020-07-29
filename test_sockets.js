const { RiteWay } = require('./models');
const RiteWayAutotransportSyncService = require('./modules/rite_way/services/RiteWayAutotransportSyncService');
const {
    broadcastEvent,
    buildBroadCastParams,
} = require('./events/eventManager');
const EVENT_TYPES = require('./events/event_types');

const RwSyncService = new RiteWayAutotransportSyncService();

(async function testSockets() {
    let quote = await RiteWay.Quote.findOne({ include: RwSyncService.quoteIncludeData() });
    
    RwSyncService.addToken(quote.Company.customerDetail.operatorUser);
    
    let eventType = EVENT_TYPES.orderStatusChange(quote);
    const params = buildBroadCastParams(eventType, quote, quote.Company.customerDetail.operatorUser, { action: 'updated', element: 'Quote' }, "", { quote_id: quote.id, view: 'quote' });
    await broadcastEvent(params);
    console.log(params);
})();