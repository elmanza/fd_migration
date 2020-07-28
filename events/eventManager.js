"use strict";
// EVENTOS
const EventEmitter = require('events');
class EmailEmitter extends EventEmitter { }
const emailEmitterEvent = new EmailEmitter();
const { sendNotification }  = require('./notifications/services/notificationService');
const { sendUpdateComponent }  = require('./notifications/services/updateComponentService');
// const { sendFcmNotification }  = require('./notifications/services/fcmNotificationService');

const emailEvents = {
    error: 'sendError'
}

const broadcastEvent = async(params) => {
  await sendNotification(params.type, params.data, params.user.id);
  await sendUpdateComponent(params.type, params.data, params.socketInformation, params.user);

  //if (params.type == "newQuote" || params.type == 'newOrder') sendFcmNotification(params.type, params.data, params.user.id)
}

const buildBroadCastParams = (eventType, data, user, typeAction, password, body) => {  
  let params = {};
      params.type = eventType;
      params.data = data;
      params.user = user;
      params.typeaction = typeAction 
      params.password = password;
      params.socketInformation = {
          eventName: eventType.updateComponent.eventName,
          eventToId: user.company_id,
          eventAction: eventType.name,
          eventData: body
      };
  return params
}
emailEmitterEvent.on('error', (error) => {
   console.error('emailEmitter', error);
});

module.exports = {
  broadcastEvent,
  buildBroadCastParams
};
