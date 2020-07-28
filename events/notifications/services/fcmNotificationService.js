const firebaseCMServices = require('../../../utils/services/Firebase/FirebaseCloudMessaging');
const TOPIC = (userId) =>{
    return `Operator.${userId}.PushNotifications`  
} 

const sendFcmNotification = async (type, object, userId) => {
    const company = type.name == "newCompany" ? object : await getToCompany(type, object);

    const message = {
        title: type.text,
        icon: company.photo
    } 

    firebaseCMServices.sendMessageByTopic(TOPIC(userId), message)
}

module.exports = {
    sendFcmNotification
}