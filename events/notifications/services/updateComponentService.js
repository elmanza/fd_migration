const EventEmitter = require('events');
class UpdateComponent extends EventEmitter { }
const updateComponentEmmiter = new UpdateComponent();
const {
  User,
  Company,
  CustomerDetail,
  Quote,
} = require('../../../models').RiteWay;
const { COMPANY_TYPES, ROLES } = require('../../../utils/constants');

const sendToUser = {
  newOperator: 'newOperator',
  newCompany: 'newCompany',
  userInfoUpdated: 'userInfoUpdated'
};
const sendToCompany = {
  updateCompany: 'updateCompany'
}
const companyThrouhQuote = {
  newOrder: 'newOrder',
  updateOrder: 'updateOrder',
  newNote: 'newNote',
  newDamage: 'newDamage',
};
const superAdmins = {
  jeff: 'jeff@riteway.io',
  raimundo: 'raimundo2@lean-tech.io',
};

const getUpdateComponentRoom = async (roomName) => {
  return await findOrCreateRoom(roomName);
};

const findOrCreateRoom = async (name) => {
  let updateComponentRoom = await UpdateComponentRoom.findOne({
    where: { name },
  });
  if (updateComponentRoom) return updateComponentRoom;

  updateComponentRoom = await UpdateComponentRoom.create({
    name: name,
    created_at: new Date(),
  });

  return updateComponentRoom;
};

const getUpdateComponentRoomName = async (params) => {
  console.log(
    ' get UC  room nameeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    params
  );
  if (!sendToUser[params.typeName]) {
    return `company_${params.objectId}`;
  } else {
    return `user_${params.objectId}`;
  }
};

const sendUpdateComponent = async (type, object, socketInformation, user) => {
  console.log('inside method  ::   ', type, socketInformation);
  if ('new' in object) object = object.new;

  const company = (type.name == 'newCompany') ? object : await getToCompany(type, object);
  console.log("jeyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy", user.id)
  var recipients = await getRecipients(type.name, company, user);
  console.log(
    'my recipentsssssssssssssssssssssssssssssssss ::   ',
    recipients
  );
  emitNotification(recipients, type, socketInformation, user);
};

const emitNotification = (recipients, type, socketInformation, user) => {
  let toCompanies = [];

  recipients.forEach((to) => {
    if (!toCompanies.includes(to.companyId)) {
      socketInformation.eventToId = to.companyId || to.toId;

      updateComponentEmmiter.emit(
        'updateComponent',
        type.name,
        socketInformation,
        user
      );
    }
    toCompanies.push(to.companyId);
  });
};

const getToCompany = async (type, object) => {
  if (companyThrouhQuote[type.name]) {
    if (object.quoteId) object.quote_id = object.quoteId;
    const quote = await Quote.findByPk(object.quote_id);
    return await Company.findByPk(quote.company_id);
  }

  return await Company.findByPk(object.company_id);
};

const getRecipients = async (typeName, object, user) => {
  return !sendToUser[typeName]
    ? await recipientsForCompanyEvents(typeName, object, user)
    : await recipientsForUserEvents(user.id);
};

const getUserByName = async (username) => {
  const user = await User.findOne({ where: { username: username } });

  if (!user) return false;

  return {
    toId: user.id,
    roleId: user.rol_id,
    companyId: user.company_id,
  };
};

const recipientsForCompanyEvents = async (typeName, object, user) => {
  const recipients = [];

  if (sendToCompany[typeName]) return await recipentsJustCompany(user);

  const jeff = await getUserByName(superAdmins.jeff);
  const raimundo = await getUserByName(superAdmins.raimundo);
  if (jeff) recipients.push(jeff);
  if (raimundo) recipients.push(raimundo);

  if (typeName != 'newCompany') {
    const operator = await getOperator(object, user.id);
    const admin = await getAdmin(object, user.id);
    if (operator) recipients.push(operator);
    if (admin) recipients.push(admin);
  }

  return recipients;
};

const recipentsJustCompany = async (user) => {
  const company = await Company.findByPk(user.company_id);
  return [{ companyId: company.id }];
}

const recipientsForUserEvents = async (userId) => {
  const user = await User.findByPk(userId)
  return [{ toId: user.id }];
};

const getOperator = async (company, userId) => {
  if (company.company_type_id == COMPANY_TYPES.RITE_WAY) {
    return {
      toId: userId,
      roleId: ROLES.OPERATOR,
      companyId: company.id,
    };
  }


  const customerDetail = await CustomerDetail.findOne({
    where: { company_id: company.id },
  });
  const operator = await User.findByPk(customerDetail.operator_id);

  if (!operator) return false;

  const operatorCompany = (await Company.findByPk(operator.company_id)) || 107;

  return {
    toId: operator.id,
    roleId: ROLES.OPERATOR,
    companyId: operatorCompany.id,
  };
};

const getAdmin = async (company, userId) => {
  if (company.company_type_id == COMPANY_TYPES.RITE_WAY) {
    return {
      toId: userId,
      roleId: ROLES.OPERATOR,
      companyId: company.id,
    };
  }


  const administrator = await User.findOne({
    where: { company_id: company.id, rol_id: ROLES.CUSTOMER_ADMIN },
  });

  if (!administrator) return false;

  return {
    toId: administrator.id,
    roleId: ROLES.CUSTOMER_ADMIN,
    companyId: company.id,
  };
};

module.exports = {
  sendUpdateComponent,
  updateComponentEmmiter,
  getUpdateComponentRoom,
  getUpdateComponentRoomName,
};
