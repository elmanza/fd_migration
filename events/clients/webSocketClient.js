require('dotenv').config();

//const { jwtAuthentication } = require('../../carrierportal_backend/utils/middleware/authHandler');
//Rol needs to be added to the DB
//const { User, Company, Rol } = require('../models/index');
const { User, Company } = require('../../models').RiteWay;
//const { getChatUsersService } = require('../../carrierportal_backend/components/user/services/userService');

class webSocketsClient {
  constructor(io, nameSpace, token){
    this.socket = io.connect(`${process.env.SOCKET_PORT}/${nameSpace}`, {query: `auth_token=${token}`});
    this.disconnect = this.disconnect.bind(this);
  }
   
  async authenticate(data) {
    const token = data.token
    const userId = await jwtAuthentication(token)
    const user = await User.findByPk(userId);

    if(user != null){
        return user;
    } else {
        return false;
    }
  }

  async authorize(userId, chatRoomName) { 
    const chatRoomUsers = chatRoomName.split("-")

    if(userId == parseInt(chatRoomUsers[0]) || userId == parseInt(chatRoomUsers[1])){
      const user = await User.findByPk(userId);
      const company = await Company.findByPk(user.company_id);
      const roles = await Rol.findByPk(user.rol_id);
      const users = await getChatUsersService(company.id, roles.name);
      
      const partnerId = userId == parseInt(chatRoomUsers[0]) ? parseInt(chatRoomUsers[1]) :  parseInt(chatRoomUsers[0]);

      return await this.canTalk(users, partnerId);
    } else {
      return false;
    }
  }

  canTalk(users, partnerId) {
    const isValidPartner = users.filter((chatUser)=> {
      return (chatUser.id == partnerId) ? true : false
    })

    return (isValidPartner.length > 0) ? true : false
  }

  async disconnect(socket) {
    socket.on('disconnect', function(){
      socket.leave(socket.room);
    });
  }

  async disconnectSocket(user, socketServer, socket) {
    if (!user){
      socketServer.in(socket.id).emit('disconnectSocket', 'you are not authorize to connect to the websocket')
      socket.disconnect(true);
    }
  }
}

module.exports = webSocketsClient;