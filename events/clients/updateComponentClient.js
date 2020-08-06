const webSocketsClient = require('./webSocketClient'); 
const { 
  updateComponentEmmiter,
  getUpdateComponentRoomName } = require('../notifications/services/updateComponentService');

class updateComponentClient extends webSocketsClient{
  constructor(io, token){
    super(io, 'updateComponents', token);
  }

  async startSocket() {
    console.log('Socket updateComponentClient connection is up and running!');
    this.getUpdateComponent();
  }

  async connectToRoom(roomName, token) {
      this.socket.emit('connectToRoom', {
        token: token,
        room: roomName
      });
  }

  async getUpdateComponent() {
    updateComponentEmmiter.on("updateComponent", async (eventName, params, user) => {
      const roomName = await getUpdateComponentRoomName({
        typeName: eventName,
        objectId: params.eventToId
      })

      this.connectToRoom(roomName, user.token)          
      this.sendUpdateComponent(roomName, user.token, params);
    });
  }

  async sendUpdateComponent(room, token, params) {
    const data = { room: room, token: token, ...params}
    console.log("Update Component <<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>>>................ token and Data :", data)
    this.socket.emit('sendUpdateComponent', data);
  }

}

module.exports = updateComponentClient;