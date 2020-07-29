const webSocketsClient = require('./webSocketClient'); 
const { 
  notificationsEmitter,
  getNotificationRoom, 
  getNotificationRoomsName,
  markNotificationsAsRead } = require('../notifications/services/notificationService');
const { Notification, UserNotification, User } = require('../../models').RiteWay;

class NotificationClient extends webSocketsClient{
  constructor(io, token){
    super(io, 'notifications', token);
  }

  async startSocket() {
    console.log(`Socket notifications connection is up and running!`);
    this.getNotification();
  }

  async connectToRoom(roomName, token) { 
      this.socket.emit('connectToRoom', {
        token: token,
        room: roomName
      });
  }

  async getNotification() {
    notificationsEmitter.on("notification", async (eventName, params, from) => {
        console.log("kkkkkkkkkkkkkkkkkasddddddddddddddddddddddddddddddd99999999999999999999ddddddd", params)
        const roomsName = await getNotificationRoomsName(params)
      
        roomsName.forEach(async (roomName) => {
          const notification_room = await getNotificationRoom(roomName)
          const userId = roomName.split("-")[2]

          let notification = await Notification.create({
            description: params.description,
            icon: params.icon,
            notification_room_id: notification_room.id,
            created_at: new Date()
          })

          await UserNotification.create({
            seen: false,
            user_id: userId,
            notification_id: notification.id
          })
          
          this.connectToRoom(roomName, from.token)          
          this.sendNotification(roomName, eventName, from.token, notification);
        })
    });
  }

  async sendNotification(room, eventName, token, notification) {
    console.log("------------ sendNotification");
    const data = {
      room: room,
      eventName: "notify", 
      eventType: eventName,
      message: {
        description: notification.description,
        created_at: notification.createdAt,
        icon: notification.icon
      }
    }
    
    data.token = token;
    console.log("Notifications <<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>>>................ token  :", data)
    // console.log("................ Notifications send event", room , eventName, data)
    this.socket.emit('sendNotification', data);
  } 

  async readNotifications(socket) {
    socket.on('read', async () => {
      const room = socket.room

      markNotificationsAsRead(room)
    });
  }
}

module.exports = NotificationClient;