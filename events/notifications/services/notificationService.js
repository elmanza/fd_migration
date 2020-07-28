const moment = require('moment');
const EventEmitter = require('events');
class NotificationsEmitter extends EventEmitter {}
const notificationsEmitter = new NotificationsEmitter();
const { NotificationRoom, Role, Notification, UserNotification, User, Company, Quote, CustomerDetail } = require('../../../models').RiteWay;

const { COMPANY_TYPES, ROLES} = require('../../../utils/constants');

const companyThrouhQuote = {
    newOrder: "newOrder",
    updateOrder: "updateOrder",
    newNote: "newNote"
}
const superAdmins = {
    jeff: "amanzano@lean-tech.io",
    raimundo: "raimundo@lean-tech.io"
}
const getNotificationRoom = async (roomName) => {
    return await findOrCreateRoom(roomName)
}

const findOrCreateRoom = async (name) => {
    console.log("----findOrCreateRoom",name);
    let notificationRoom = await NotificationRoom.findOne({where: {name}})
    if (notificationRoom) return notificationRoom;

    const userId = name.split("-")[2]
    const user = await User.findByPk(userId) 

    console.log("Llegamos aca");
    notificationRoom = await NotificationRoom.create({
        name: name,
        user_id: user.id,
        created_at: new Date()
    })

    return notificationRoom
}

const getNotificationRoomsName = async (params) => {
    const rol = await Role.findByPk(params.to_role_id)
    let room;

    room = [await buildNotificationRoomName(rol.name, params)]
    console.log(room);
    return room
}

const buildNotificationRoomName = async (rol, params) => { 
    return `${params.company_id}-${rol}-${params.to_id}`
}

const getNotificationsRoomHistory = async(roomName) => {
    const notificationRoom = await findOrCreateRoom(roomName)

    const query = {
        where: {notification_room_id: notificationRoom.id},
        include: [
            {
                model: UserNotification,
                required: true,
                where: {"seen": false}
            }
        ]
    }
    let notifications = await Notification.findAll(query)

    if(!notifications) return []
    
    return await parseNotifications(notifications)
}

const parseNotifications = async(notifications) => {
    notifications = notifications.map((notification) => {
        return {
            description: notification.description,
            icon: notification.icon,
            created_at: notification.createdAt
        }
    })
    
    return notifications
}

const markNotificationsAsRead = async (roomName) => {
    const notificationRoom = await NotificationRoom.findOne({where: {name: roomName}})
    const notifications = await Notification.findAll({where: {notification_room_id: notificationRoom.id}})
    
    notifications.map(async (notification) => {
        let userNotification = await notification.getUser_notifications();
        let id = userNotification[0] ? userNotification[0].id : null
 
        if(id) {
            userNotification = await UserNotification.findByPk(id)
            await userNotification.update({seen: true})
        }
    })
}

const sendNotification = async (type, object, userId) => {
    if(type.notification.send == false) return;

    if("new" in object) object = object.new;
   
    const from = await User.findByPk(userId)
    const company = type.name == "newCompany" ? object : await getToCompany(type, object);

    var description = buildNotificationDescription(type.notification.text, company, from)
    var recipients = await getRecipients(type.name, company, userId);    

    recipients.forEach((to)=>{
        emitNotification(type.name, userId, to.toId, to.roleId, to.companyId, description) 
    })        
}

const getToCompany = async (type, object) => {
    if(companyThrouhQuote[type.name]){
        if(object.quoteId) object.quote_id = object.quoteId;

        const quote = await Quote.findByPk(object.quote_id);
        return await Company.findByPk(quote.company_id);
    }

    return await Company.findByPk(object.company_id)
}

const emitNotification = (typeName, fromId, toId, roleId, companyId, description, icon ="alert") => { 
    notificationsEmitter.emit("notification", typeName, {
        from_id: fromId,
        to_id: toId,
        to_role_id: roleId,
        company_id: companyId,
        description: description,
        icon: icon,
    });
}

const buildNotificationDescription = (text, company, user) => {
    return `${company.photo} /--|--/ ${text} /--|--/ by ${user.name} ${user.last_name} ${moment().format("DD/MM/YYYY hh:mm")}`
}

const getRecipients = async (typeName, object, userId) => {
    const recipients = []

    const jeff = await getUserByName(superAdmins.jeff);
    const raimundo = await getUserByName(superAdmins.raimundo); 
    if(jeff) recipients.push(jeff);
    if(raimundo) recipients.push(raimundo);

    if(typeName != "newCompany") {
        const operator = await getOperator(object, userId);
        const admin = await getAdmin(object, userId)  
        if (operator) recipients.push(operator);
        if (admin) recipients.push(admin);
    }

    return recipients
}

const getUserByName = async (username) => {
    const user = await User.findOne({where : { username: username}});
    
    if(!user) return false;

    return {
        toId: user.id,
        roleId: user.rol_id,
        companyId: user.company_id
    }
}

const getOperator = async (company, userId) => {
    if(company.company_type_id == COMPANY_TYPES.RITE_WAY){
        return {
            toId: userId,
            roleId: ROLES.OPERATOR,
            companyId: company.id
        }
    }

    
    const customerDetail = await CustomerDetail.findOne({where: {company_id: company.id}})
    const operator = await User.findByPk(customerDetail.operator_id)
    
    if(!operator) return false;

    const operatorCompany = await Company.findByPk(operator.company_id) || 107;

    return {
        toId: operator.id,
        roleId: ROLES.OPERATOR,
        companyId: operatorCompany.id
    }
}

const getAdmin = async (company, userId) => {
    if(company.company_type_id == COMPANY_TYPES.RITE_WAY){
        return {
            toId: userId,
            roleId: ROLES.OPERATOR,
            companyId: company.id
        }
    }

    
    const administrator = await User.findOne({where: {company_id: company.id, rol_id: ROLES.CUSTOMER_ADMIN}});

    if(!administrator) return false;

    return {
        toId: administrator.id,
        roleId: ROLES.CUSTOMER_ADMIN,
        companyId: company.id
    }
}

module.exports = {
    notificationsEmitter,
    getNotificationRoom,
    buildNotificationRoomName,
    getNotificationRoomsName,
    getNotificationsRoomHistory,
    markNotificationsAsRead,
    emitNotification,
    getRecipients,
    buildNotificationDescription,
    sendNotification
}
