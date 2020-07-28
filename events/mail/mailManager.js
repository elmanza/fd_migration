"use strict";
// EVENTOS
const EventEmitter = require('events');
class EmailEmitter extends EventEmitter { }
const emailEmitter = new EmailEmitter();
const emailEvents = {
    error: 'sendError'
};

// MAIL MANAGER
const sendMailManager = require('./services/sendMailManager');

// TEMPLATES
const {containerEmail} = require('./services/templates/emailContainerTemplate');
const {welcomeTemplate} = require('./services/templates/welcomeTemplate');
const { quoteOrderTemplate  } = require('./services/templates/quoteOrderTemplate');
const { quoteCancelledTemplate  } = require('./services/templates/quoteCancelledTemplate');
const { keyTemplate, valueTemplate } = require('./services/templates/valueKeyTemplate');
const {templateOrder} = require('./services/templates/orderUpdatedTemplate');
const {vehicleTemplate} = require('./services/templates/vehiclesTemplate');

// MOMENTS
const moment = require('moment-timezone');

// UTILS
const { distance } = require('./services/distanceCalculator');

// QUERY's
const { getQuote } = require('../../components/quote/queries/index')
const { getOrder } = require('../../components/order/queries/index');

// CONFIG AND MODELS
const { config } = require('../../configs/config');
const { ritewayDB } = require('../../configs/databases');
const { GisCity } = require('../../models');

const Sequelize = require('sequelize');

class MailManager {

   constructor() {}

  delay (ms){
      let promise = new Promise(resolve => setTimeout(resolve, ms));
      return promise;
  };
  
  emailFunctions(typeName) {
    const mapFunctions = {
        "newUser": this.eventNewOperator,
        "newCompany": this.eventNewCompany,
        "newQuote": this.createdQuoteorOrder,
        "updateQuote": this.updateQuote,
        "deleteQuote": this.deleteQuote,
        "newOrder": this.createdQuoteorOrder,
        "updateOrder": this.updateOrder,
        "deleteOrder": this.deleteOrder,
        "sendErrorMacropoint": this.sendErrorMacropoint
    }

    return mapFunctions[typeName]
}
  async sendEmail(params) {
    this.params = params;
    if(params.type.email.send == false) return;

    this.emailFunctions(params.type.name).bind(this)(params);
  }
    
  async eventNewCompany(data){ 
      try {
        const content = welcomeTemplate(data.data.email, data.password, data.photo);
        const dataBody = containerEmail(content);
        await sendMailManager.sendMail(data.user.username, "New company was created", dataBody, config.supportEmails);
        return await sendMailManager.sendMail(data.data.email, "Welcome to Rite Way", dataBody, config.supportEmails);
      } catch (error) {
          return emailEmitter.emit(emailEvents.error, error);
      }
  };
  
  async eventNewOperator(data){
      try {
        const content = welcomeTemplate(data.data.username, data.password, "");
        const dataBody = containerEmail(content);  
        await sendMailManager.sendMail(data.user.username, "New operator was created", dataBody, config.supportEmails);
        return await sendMailManager.sendMail(data.data.username,"Welcome to Rite Way", dataBody, config.supportEmails);
      } catch (error) {
          return this.sendErrorMessage(error);
      }
  };

  async createdQuoteorOrder (data){
    await this.delay(10000);    
    const emails = await this._getOperators(data.data, data.typeaction.element);
    const localElement = await this.handleManagement(data.data.id, data.typeaction.element);
    let miles = await this.getDistance(data.data.origin_city_id, data.data.destination_city_id);

    localElement.miles = miles.toFixed(2);

    let idToSearch = data.typeaction.element == 'Order'?localElement.quote_id:localElement.id;
    const tableVehicles = await this.handleVehiclesMap(idToSearch, data.typeaction.element)
    const {htmlKey, htmlValue} = await this._createtable(localElement, data.typeaction.element);
    console.log("ljkbññññññññññññññññññññññññññññññññññññññ");
    console.log(data);
    try {
        const htmlBody = quoteOrderTemplate( htmlKey, htmlValue, tableVehicles, data.typeaction);

        await sendMailManager.sendMail(data.user.username, `You created quote successfully`, htmlBody);
        return await sendMailManager.sendMail(emails, `${data.typeaction.element} ${localElement.fd_number} ${data.typeaction.action}`, htmlBody, config.supportEmails);
        // await sendMailManager.sendMail('dmejia@lean-tech.io', `You ${data.typeaction.action} ${data.typeaction.element} successfully`, htmlBody);
        // return await sendMailManager.sendMail('davidndy@gmail.com', `${data.user.name} ${data.typeaction.action} ${data.typeaction.element} ${localElement.fd_number} `, htmlBody, config.supportEmails);
    } catch (error) {
        console.log(error)
        return emailEmitter.emit(emailEvents.error, error);
    }
  }

  async updateQuote(data){
    let data2 = data;
    console.log("This is a Quote update:............................................................")
    try {
      const users = await this._findUsersByCompany(data2.data.new.company_id);
      let fdNumber = data2.data.new.id;
      if(data2.data.quote['fd_number']) {
          let quotesData = data2.data.quote['fd_number'].split('-');
          fdNumber = quotesData[1];
      }
      //let differences = await this._matchObjectDifferences(data2.data.quote, data2.data.oldQuote);
      const localElement = await this.handleManagement(data2.data.new.id, 'Quote');
      let miles = await this.getDistance(localElement.origin_city,localElement.destination_city);
      localElement.miles = miles.toFixed(2);
      const tableVehicles = await this.handleVehiclesMap(localElement.id, data2.typeaction.element)
      const {htmlKey, htmlValue} = await this._createtable(localElement, data2.typeaction.element);
      const htmlBody = quoteOrderTemplate( htmlKey, htmlValue, tableVehicles, data2.typeaction);
      await sendMailManager.sendMail(data.user.username, `You ${data2.typeaction.action} ${data2.typeaction.element} ${localElement.fd_number} successfully`, htmlBody, users.admins);
      return await sendMailManager.sendMail(users.operators, `${data.user.name} ${data.typeaction.action} the ${data.typeaction.element} ${localElement.fd_number}`, htmlBody, config.supportEmails);
    } catch (error) {
        console.log(error);
        return emailEmitter.emit(emailEvents.error, error);
    }    
  }

  

  async updateOrder(data){
    let data2 = data;
    try {
      const config = await this._getMyEmailsConfig(data2.data.new.id);
      if(config.length > 0){
          const emails = await this._getEmails(data2.data.new.id);
          const htmlBody = false;
          if(config['order_delivered'] && data2.data.new.status === 'delivered') htmlBody = await this._createMessage(data2.data.order, data2.user);
          if(config['order_pickup'] && data2.data.new.status === 'pickedup') htmlBody = await this._createMessage(data2.data.order, data2.user);
          const newEmails = emails.map(({email}) => email);
          if(!htmlBody) return true;
          if(!data2.data.new.quote) data2.data.new.quote = await this.handleManagement(data2.data.new.quote_id, 'Quote');
          return await sendMailManager.sendMail(newEmails, `Order ${data2.data.new.quote.fd_number} updated`, htmlBody,config.supportEmails);
      }else{
          return true;
      }
    } catch (error) {
        return emailEmitter.emit(emailEvents.error, error);
    }
  }

  async deleteOrder(data){
    let data2 = data;
    try {
        const localElementCompany = await this.handleManagement(data2.data.quote_id, 'Quote');
        console.log(localElementCompany);
      const users = await this._findUsersByCompany(localElementCompany.company_id);
      const type = { action: 'cancelled', element: 'Order'}
      
      const localElement = await this.handleManagement(data2.data.id, 'Order');
      console.log(localElement);
      let miles = await this.getDistance(localElement.location_origin_id,localElement.location_destination_id);
      localElement.miles = miles.toFixed(2);
      const tableVehicles = await this.handleVehiclesMap(localElement.quote_id, data2.typeaction.element)
      const {htmlKey, htmlValue} = await this._createtable(localElement, data2.typeaction.element);

      const htmlBody = quoteCancelledTemplate( htmlKey, htmlValue, tableVehicles, data2.typeaction, `The user ${data2.user.name} (${data2.user.username}) has cancelled the ${data2.typeaction.element} ${localElement.fd_number}`);
      // await sendMailManager.sendMail(data.user.username, `You ${data2.typeaction.action} ${data2.typeaction.element} ${localElement.fd_number} successfully`, htmlBody);
      // return await sendMailManager.sendMail(emails, `${data.data2.typeaction.element} ${localElement.fd_number} ${data.data2.typeaction.action}`, htmlBody, config.supportEmails);
      await sendMailManager.sendMail(data.user.username, `You ${data2.typeaction.action} ${data2.typeaction.element} ${localElement.fd_number} successfully`, htmlBody, config.supportEmails);
      return await sendMailManager.sendMail(users, `${data2.typeaction.element} ${localElement.fd_number} ${data2.typeaction.action}`, htmlBody, config.supportEmails);
    } catch (error) {
        console.log(error);
        return emailEmitter.emit(emailEvents.error, error);
    } 
  }
  
  async deleteQuote(data){
    let data2 = data;
    try {
      const users = await this._findUsersByCompany(data2.data.company_id);
      const type = { action: 'cancelled', element: 'Quote'}
      
      const localElement = await this.handleManagement(data2.data.id, 'Quote');
      let miles = await this.getDistance(localElement.origin_city,localElement.destination_city);
      localElement.miles = miles.toFixed(2);
      const tableVehicles = await this.handleVehiclesMap(localElement.id, data2.typeaction.element)
      const {htmlKey, htmlValue} = await this._createtable(localElement, data2.typeaction.element);
      

      const htmlBody = quoteCancelledTemplate( htmlKey, htmlValue, tableVehicles, type, `The user ${data2.user.name} (${data2.user.username}) has cancelled the ${data2.typeaction.element} ${localElement.fd_number}`);
      // await sendMailManager.sendMail(data.user.username, `You ${data2.typeaction.action} ${data2.typeaction.element} ${localElement.fd_number} successfully`, htmlBody);
      // return await sendMailManager.sendMail(emails, `${data.data2.typeaction.element} ${localElement.fd_number} ${data.data2.typeaction.action}`, htmlBody, config.supportEmails);
      await sendMailManager.sendMail('ar_manzano@hotmail.com', `You ${data2.typeaction.action} ${data2.typeaction.element} ${localElement.fd_number} successfully`, htmlBody);
      return await sendMailManager.sendMail('ar.manzano.94@gmail.com', `${data2.typeaction.element} ${localElement.fd_number} ${data2.typeaction.action}`, htmlBody, config.supportEmails);
    } catch (error) {
        console.log(error);
        return emailEmitter.emit(emailEvents.error, error);
    } 
  }

  async _createMessage(order, user){
    const htmlBody = templateOrder(order, user);
    return htmlBody;
  }

  async _getMyEmailsConfig (id) {
    try{
        const emailConfig =  await ritewayDB.query(`
            select email_notifications.*
            from companies
            inner join quotes on quotes.company_id = companies.id
            inner join orders on orders.quote_id = quotes.id
            inner join email_notifications on email_notifications.company_id = companies.id
            where orders.id = ${id}
            `,
            { type: ritewayDB.QueryTypes.SELECT});
            return emailConfig;
        }catch(error){
            throw error;
        }
  }
  async _getEmails(id) {
    try{
        const emails =  await ritewayDB.query(`
                select email_lists.email
                from orders
                inner join quotes on quotes.id = orders.quote_id
                inner join companies on companies.id = quotes.company_id
                inner join email_notifications on email_notifications.company_id = companies.id
                inner join email_lists on email_lists.email_notifications_id = email_notifications.id
                where orders.id = ${id}
            `,
            { type: ritewayDB.QueryTypes.SELECT});
        return emails;
        }catch(error){
            throw error;
        }
  }

   async sendErrorMessage(error) {
      try {
          const htmlBody = `
          <head>
              <style>
                  table, th, td {
                      border: 1px solid black;
                      border-collapse: collapse;
                  }
              </style>
          </head>
          <body>
              <p>
                  <table>
                      <tr>
                          <td><strong>Name</strong></td>
                          <td>${error.name}</td>
                      </tr>
                      <tr>
                          <td><strong>message</strong></td>
                          <td>${error.message}</td>
                      </tr>
                      <tr>
                          <td><strong>stack</strong></td>
                          <td>${error.stack}</td>
                      </tr>
                  </table>
              </p>
          </body>
          `;
          await sendMailManager.sendMail([config.mailErrors], 'Error Rite Way', htmlBody);
          return;
      } catch (error) {
          return emailEmitter.emit('error', error);
      }
  }

  async sendErrorMacropoint(params) {
    try {
        const htmlBody = `
        <head>
            <style>
                table, th, td {
                    border: 1px solid black;
                    border-collapse: collapse;
                }
            </style>
        </head>
        <body>
            <p>
                <table>
                    <tr>
                        <td><strong>Name</strong></td>
                        <td>${params.error.name}</td>
                    </tr>
                    <tr>
                        <td><strong>message</strong></td>
                        <td>${params.error.message}</td>
                    </tr>
                    <tr>
                        <td><strong>stack</strong></td>
                        <td>${params.error.stack}</td>
                    </tr>
                </table>
            </p>
        </body>
        `;
        await sendMailManager.sendMail([config.mailErrors], 'Error Rite Way', htmlBody);
        return;
    } catch (error) {
        return emailEmitter.emit('error', error);
    }
}


  async _matchObjectDifferences(newObject, oldObject ){
    let object = [];
    let vehiclesInfo = [];
    const newOldObject = oldObject;
    const newNObject = newObject.toJSON();
    Object.keys(newOldObject).forEach(key => {
        let newValue = newNObject[key];
        let oldValue = newOldObject[key];
        if(newOldObject[key] instanceof Date) {
            newValue =  moment(newValue).format("YYYY-MM-DD").toString();
            oldValue =  moment(oldValue).format("YYYY-MM-DD").toString();
        }
        if(Array.isArray(newNObject[key])){
            if(Object.keys(newNObject[key][0]).length == Object.keys(newOldObject[key][0]).length){
                let stateV = "";
                Object.keys(newNObject[key][0]).forEach(key2 => {  
                    if(newNObject[key][0][key2] == newOldObject[key][0][key2]){
                        stateV = "same";
                    }else{
                        stateV = "different"
                    }
                    vehiclesInfo.push({
                        key: key2,
                        old: newOldObject[key][0][key2],
                        new: newNObject[key][0][key2],
                        state: stateV
                    });
                });
                object.push({
                  key: key,
                  old: "",
                  new: vehiclesInfo,
                  state: "vihecles"
                });                
            }else{
                object.push({
                    key: key,
                    old: oldValue,
                    new: newValue,
                    state: "different"
                });
            }            
        }else{
          let stateO = "";
          if(newNObject[key] == newOldObject[key]){
            stateO = "same";
          }else{
            stateO = "different";
          }
          object.push({
            key: key,
            old: oldValue,
            new: newValue,
            state: stateO
          });
        }
        
    });
    return object;
  }

  async _messageFactory(messageArray = []){
    let msg = [];
    if(messageArray.length <= 0) return msg;
    messageArray.forEach(value => {
        if(typeof value.old == 'object' || typeof value.new == 'object'){
            msg.push(`the ${value.key} changed`);
        }
        else{
            msg.push(`the ${value.key} change of ${value.old} to ${value.new}`);
        }
    })
    return msg;
  }

  async _getOperators(element, type) {
    try{
      let operators = '';
      if(type == 'Quote'){
          operators =  await ritewayDB.query(`
              select users.username as email
              from customer_details
              inner join users on users.id = customer_details.operator_id
              where customer_details.company_id = ${element.company_id}
          `,{ type: ritewayDB.QueryTypes.SELECT});
      }else{
          operators =  await ritewayDB.query(`
              select users.username as email, companies.id
              from companies
              inner join users on users.id = companies.operator_id
              inner join quotes on quotes.company_id = companies.id and quotes.id = ${element.quote_id}
              `,{ type: ritewayDB.QueryTypes.SELECT});
      }
      const emails = operators.map(user => user.email)
      return emails;
      }catch(error){
          throw error;
      }
  }


  async _findUsersByCompany(company_id){
    const myUsers =  await ritewayDB.query(`
            select users.*
            from companies
            inner join users on users.company_id = companies.id and users.is_company_admin = true
            where companies.id = ${company_id}
            union
            select users.*
            from companies
            inner join users on users.id = companies.operator_id
            where companies.id = ${company_id}
    `,{ type: ritewayDB.QueryTypes.SELECT});

        const response = {
            operators:[],
            admins:[]
        };
        myUsers.forEach(user => {
            if(user.is_operator){
                response.operators.push(user)
            }else{
                response.admins.push(user)
            }
        });
        return response;
  }

  async handleManagement  (id, type) {
    let query = type == 'Quote'?getQuote(id):getOrder(id);
    const element = await ritewayDB.query( query,{ type: ritewayDB.QueryTypes.SELECT})
    return  element[0];
  }

  async getDistance (cityAId, cityBId) {
    let origin = await GisCity.findByPk(cityAId, { attributes: [
        'id', 'name',
        [Sequelize.fn('ST_X', Sequelize.col('centroid')), 'long'],
        [Sequelize.fn('ST_Y', Sequelize.col('centroid')), 'lat']
      ]});
    let destination = await GisCity.findByPk(cityBId, { attributes: [
        'id', 'name',
        [Sequelize.fn('ST_X', Sequelize.col('centroid')), 'long'],
        [Sequelize.fn('ST_Y', Sequelize.col('centroid')), 'lat']
      ]});

      return await distance(origin.toJSON().lat, destination.toJSON().lat, origin.toJSON().long, destination.toJSON().long) 
  }

  async handleVehiclesMap(id, type = 'Order') {
    let numberRow = 0;
    let htmlMake = ``
    let htmlModel = ``
    let htmlYear = ``
    let htmlTariff = ``
    const vehicles = await this._getvehicles(id);
    vehicles.forEach((vehicle) => {
            let rowType = (numberRow%2)==0;
            htmlMake = htmlMake + valueTemplate(vehicle.vehicle_maker, rowType);
            htmlModel = htmlModel + valueTemplate(vehicle.vehicle_model, rowType);
            htmlYear = htmlYear + valueTemplate(vehicle.vehicle_year, rowType);
            if(type == 'Order'){
                htmlTariff = htmlTariff + valueTemplate(vehicle.tariff, rowType);
            }
            numberRow = numberRow +1;
    });
    const table = vehicleTemplate(htmlModel, htmlMake, htmlYear, htmlTariff);
    return table;
  }

  async _getvehicles (id){
    let query = `select
        vehicles."year" as vehicle_year,
        vehicles.carrier_pay as carrier_pay,
        vehicles.vin as vin,
        vehicles.plate as plate,
        vehicles.tariff as tariff,
        vehicle_models."name" as vehicle_model,
        vehicle_makers."name" as vehicle_maker,
        vehicle_types."name" as vehicle_type
    from
        vehicles
    inner join quotes on
        vehicles.quote_id = quotes.id and quotes.id = ${id}
    inner join vehicle_models on
        vehicle_models.id = vehicles.model_id
    inner join vehicle_makers on
        vehicle_makers.id = vehicle_models.maker_id
    inner join vehicle_types on
        vehicle_types.id = vehicles.type_id
    `;
    return await ritewayDB.query(query,{ type: ritewayDB.QueryTypes.SELECT});
  }

  async _createtable (element){
    let htmlKey = ``
    let htmlValue = ``
    htmlKey = htmlKey + keyTemplate('User Create', false);
    htmlValue = htmlValue + valueTemplate(`${element.user_create_name} ${element.user_create_last_name}`, false);
    htmlKey = htmlKey + keyTemplate('FD number', true);
    htmlValue = htmlValue + valueTemplate(element.fd_number?element.fd_number:'Unassigned', true);
    htmlKey = htmlKey + keyTemplate('FD identification', false);
    htmlValue = htmlValue + valueTemplate(element.fd_id?element.fd_id:'Unassigned', false);
    htmlKey = htmlKey + keyTemplate('Create Date', true);
    htmlValue = htmlValue + valueTemplate(moment(element.created_at).format("YYYY-MM-DD").toString(), true);
    htmlKey = htmlKey + keyTemplate('Company Name', false);
    htmlValue = htmlValue + valueTemplate(element.company_name, false);
    htmlKey = htmlKey + keyTemplate('Origin', true);
    htmlValue = htmlValue + valueTemplate(`${element.origin_state_name}, ${element.origin_city_name}`, true);
    htmlKey = htmlKey + keyTemplate('Destination', false);
    htmlValue = htmlValue + valueTemplate(`${element.destination_state_name}, ${element.destination_city_name}`, false);
    htmlKey = htmlKey + keyTemplate('Miles', true);
    htmlValue = htmlValue + valueTemplate(`${element.miles}`, true);
    return {
        htmlKey, htmlValue
    }
  }
  

}



const mailManager = new MailManager();

emailEmitter.on(emailEvents.error, mailManager.sendErrorMessage);
emailEmitter.on('error', (error) => {
   console.error('emailEmitter', error);
});

module.exports = mailManager;
