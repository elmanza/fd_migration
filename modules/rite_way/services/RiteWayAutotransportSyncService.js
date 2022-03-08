const moment = require('moment');
const fs = require('fs');

const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const { RiteWay, Stage } = require("../../../models");
const { StageQuote, OperatorUser } = Stage;
const { ritewayDB: riteWayDBConn } = require('../../../config/database');

const path = require('path');
const Crypter = require('../../../utils/crypter');
const Logger = require('../../../utils/logger');

const { FDConf, RWAConf, SyncConf } = require('../../../config');
const FreightDragonService = require('../../freight_dragon/services/FreightDragonService');
const HTTPService = require('../../../utils/HTTPService');
const JWTService = require('../../../utils/JWTService');
const RiteWayAutotranportService = require('./RiteWayAutotransportService');
const { ORDER_STATUS, QUOTE_STATUS, INVOICE_TYPES } = require('../../../utils/constants');

//SOCKETS
const {
    broadcastEvent,
    buildBroadCastParams,
} = require('../../../events/eventManager');
const EVENT_TYPES = require('../../../events/event_types');

class RiteWayAutotranportSyncService extends RiteWayAutotranportService {
    constructor() {
        super();
        this.FDService = new FreightDragonService();
        this.httpService = new HTTPService();
        this.statusToSymbol = {};

        this.initializeStatusToSymbol();
        this.response = {};
                this.response.customer_balance_paid_by = {}
                
                this.response.customer_balance_paid_by.error = 0;
                this.response.customer_balance_paid_by.error_arr= [];

                this.response.customer_balance_paid_by.different++;
                this.response.customer_balance_paid_by.different_arr;

                this.response.customer_balance_paid_by.igual= 0;
                this.response.customer_balance_paid_by.new=0;

    }

    addToken(user) {
        user.token = JWTService.generate({
            id: user.id
        });
    }

    initializeStatusToSymbol() {
        for (const status in QUOTE_STATUS) {
            let statusId = QUOTE_STATUS[status];
            this.statusToSymbol[statusId] = status.toLowerCase();
        }

        for (const status in ORDER_STATUS) {
            let statusId = ORDER_STATUS[status];
            this.statusToSymbol[statusId] = status.toLowerCase();
        }
    }

    //IMPORT DATA=========================================
    async importCarrierDriver(carrierData, driverData, order, quote, optQuery) {
        // let carrier;
        // console.log("CARRIER --> ", carrierData, " DRIVEDATA --> ", driverData);
        let conditions = [];
            conditions.push(Sequelize.where(
                Sequelize.col('email'),
                'ilike',
                `${carrierData.email.trim()}`
            ));
        let carrier = await RiteWay.Company.findOne({
            include: {
                model: RiteWay.CarrierDetail,
                required: false,
                as: 'carrierDetail'
            },
            where: {
                [sqOp.or]: [
                    ...conditions
                ]
            },
            subQuery: false
        });











        if (typeof carrierData.id == 'undefined' && carrier == null) {
            carrier = await RiteWay.Company.create(carrierData, optQuery);
            carrierData.id = carrier.id;

            await riteWayDBConn.query(
                'UPDATE companies SET created_at = :created_at, updated_at = :updated_at, deleted_at = :deleted_at WHERE id = :id',
                {
                    ...optQuery,
                    replacements: { ...carrierData, id: carrier.id },
                    type: Sequelize.QueryTypes.UPDATE,
                    raw: true
                }
            );

            Logger.info(`Carrier of ${quote.fd_number} created ${carrier.id}`);
        }
        else {
            // carrier = await RiteWay.Company.findByPk(carrierData.id);
        }

        if (carrier) {
            await order.update({
                carrier_id: carrier.id
            }, optQuery);

            let [carrierDetail, isNewCarrierDetail] = await RiteWay.CarrierDetail.findOrCreate({
                defaults: carrierData.carrierDetail,
                where: {
                    company_id: carrier.id
                },
                ...optQuery
            });

            if (isNewCarrierDetail) {
                await carrierDetail.update(carrierData.carrierDetail, optQuery);
            }

            Logger.info(`CarrierDetail of carrier ${carrier.id} was updated`);
        }
        
        if (driverData) {
            const driver = await this.getUser(
                {
                    ...driverData,
                    company_id: carrier.id
                },
                driverData.username,
                optQuery);

            const [driverDetail, isNewDriverDetail] = await RiteWay.DriverDetail.findOrCreate({
                defaults: {
                    ...driverData.driverDetail,
                    driver_id: driver.id
                },
                where: {
                    driver_id: driver.id
                },
                ...optQuery
            });

            if (!isNewDriverDetail) {
                await driverDetail.update(driverData.driverDetail, optQuery);
            }

            await order.update({
                driver_id: driver.id
            }, optQuery);

            Logger.info(`Driver of ${quote.fd_number} created ${driver.id}`);
        }
    }

    async importOrderData(orderData, quote, optQuery) {
        try{
        let originLocation = await RiteWay.Location.create(orderData.originLocation, optQuery);
        let destinationLocation = await RiteWay.Location.create(orderData.destinationLocation, optQuery);
        console.log("......................importOrderData A");
        await RiteWay.ContactInformation.create({
            ...orderData.originLocation.contact_information,
            location_id: originLocation.id
        }, optQuery);
        console.log("......................importOrderData B");
        await RiteWay.ContactInformation.create({
            ...orderData.destinationLocation.contact_information,
            location_id: destinationLocation.id
        }, optQuery);

        if (Array.isArray(orderData.status_id)) {
            orderData.status_id = orderData.status_id[0];
        };
        let order = await RiteWay.Order.create({
            ...orderData,
            user_accept_id: quote.user_create_id,
            location_destination_id: destinationLocation.id,
            location_origin_id: originLocation.id,
        }, optQuery);
        orderData.id = order.id;

        await riteWayDBConn.query(
            'UPDATE orders SET created_at = :created_at, updated_at = :updated_at, deleted_at = :deleted_at WHERE id = :id',
            {
                ...optQuery,
                replacements: { ...orderData, id: order.id },
                type: Sequelize.QueryTypes.UPDATE,
                raw: true
            }
        );

        Logger.info(`Order created of ${quote.fd_number} with ID ${quote.id}`);

        // B2B and Dispatch Sheet documents
        if(orderData.files.length > 0){
            let FDOrderID = quote.fd_number;
            let orderLoadFile = {
                quote_id: orderData.quote_id,
                fd_number: quote.fd_number,
                order_id: orderData.id,
                created_at: order.created_at,
                company_id: quote.company_id
            }
            orderData.files.forEach(archivo => {
                let name_original = archivo.name_original;
                archivo.FDOrderID = FDOrderID;
                if(name_original.startsWith('B2B Order Form')){
                    this.loadFile(archivo, "b2b", orderLoadFile, optQuery);
                }
                if(name_original.startsWith('Dispatch sheet')){
                    this.loadFile(archivo, "dispatchsheet", orderLoadFile, optQuery);
                }
            });
        }

        if (orderData.carrier) {
            await this.importCarrierDriver(orderData.carrier, orderData.driver, order, quote, optQuery);
        }

        if (orderData.payments.length > 0) {
            for (let i = 0; i < orderData.payments.length; i++) {
                let paymentData = orderData.payments[i];

                let payment = await RiteWay.Payment.create({
                    ...paymentData,
                    order_id: orderData.id
                }, optQuery);

                await riteWayDBConn.query(
                    'UPDATE payments SET created_at = :created_at, updated_at = :updated_at WHERE id = :id',
                    {
                        ...optQuery,
                        replacements: { ...paymentData, id: payment.id },
                        type: Sequelize.QueryTypes.UPDATE,
                        raw: true
                    }
                );
                Logger.info(`Payment of ${quote.fd_number} created ${payment.id}`);
            }
        }

        if (orderData.paymentCards.length > 0) {
            console.log(orderData.paymentCards, "asdasd", quote.company_id)
            for (let i = 0; i < orderData.paymentCards.length; i++) {
                let creditCard = orderData.paymentCards[i];
                // console.log(creditCard);
                await RiteWay.CompanyCreditCard.findOrCreate({
                    where: {
                      company_id: quote.company_id,
                      card_number: creditCard.card_number
                    },
                    defaults: {
                        ...creditCard,
                        company_id: quote.company_id
                    },                    
                    ...optQuery
                  });
                Logger.info(`Credit Card added - company_id =  of ${quote.company_id}`);
            }
            // console.log(creditCard);
            // Logger.info(`Credit Card NO ADDED - company_id =  of ${quote.company_id}`);
        }

        if (orderData.paymentsChecks.length > 0) {
            console.log("Estoy en cheques", orderData.paymentsChecks);
            for (let i = 0; i < orderData.paymentsChecks.length; i++) {
                let paymentOrderChecks = await RiteWay.OrderChecks.create({
                    batch_id: orderData.paymentsChecks[i].check_number,
                    order_id: orderData.id
                }, optQuery);

                Logger.info(`OrderChecks of ${quote.fd_number} created ${paymentOrderChecks.id}`);
            }
        }

        if (orderData.invoice) {
            orderData.invoice.invoice_url = orderData.invoice.invoice_url == "" ? "" : await this.syncInvoiceFlow(quote, orderData.id,  orderData.invoice);
            let invoice = await RiteWay.Invoice.create({
                ...orderData.invoice,
                order_id: orderData.id
            }, optQuery);
            // await this.syncInvoiceFlow(quote, optQuery);
            Logger.info(`Invoice of ${quote.fd_number} created ${invoice.id}`);
        }

        if (orderData.invoiceCarrierData) {
            
        // console.log("-------------------V invoiceCarrierData 22 ", orderData.invoiceCarrierData[0]);
            let invoiceCarrier = await RiteWay.Invoice.create({
                ...orderData.invoiceCarrierData[0],
                order_id: orderData.id
            }, optQuery);
            Logger.info(`InvoiceCarrier of ${quote.fd_number} created ${invoiceCarrier.id}`);
        }else{
            // condicionales
        }

        
        // await transaction.commit();
      }catch(error){
        await optQuery.transaction.rollback();
            console.log(error);
            Logger.error(`All changes was rollback of  ${FDEntity.FDOrderID}`);
            Logger.error(error);
            throw error;
      }
    }
    async importFDCarrier(FDCarrier){
      let transaction = undefined;
        try {
          let conditions = [];

          transaction = await riteWayDBConn.transaction();
          let optQuery = { transaction, paranoid: false };
          let today = moment().format('YYYY-MM-DD hh:mm:ss');
           console.log("PUNTO 1");
          if (FDCarrier.email) {
              conditions.push(Sequelize.where(
                  Sequelize.col('email'),
                  'ilike',
                  `${FDCarrier.email.trim()}`
              ));
          }
          let carrier = await RiteWay.Company.findOne({
              include: {
                  model: RiteWay.CarrierDetail,
                  required: false,
                  as: 'carrierDetail'
              },
              where: {
                  [sqOp.or]: [
                      ...conditions
                  ]
              },
              subQuery: false
          });

          // Insercciones
          if(carrier){
            console.log("PUNTO 2");
            let new_carrier_detail = {
              insurance_doc: `https://freightdragon.com//application/accounts/getdocs/id/${FDCarrier.insurance_doc_id}/type/1`,
              //hours_of_operation: FDCarrier.hours_of_operation,
              insurance_expire: FDCarrier.insurance_expirationdate,
              dispatcher_id: 848,
              insurance_iccmcnumber: FDCarrier.insurance_iccmcnumber,
              company_id: carrier.id
            }
            let [carrierDetail, isNewCarrierDetail] = await RiteWay.CarrierDetail.findOrCreate({
              defaults: new_carrier_detail,
              where: {
                    company_id: carrier.id
                },
                ...optQuery
            });

            if (!isNewCarrierDetail) {
                await carrierDetail.update(new_carrier_detail, optQuery);
            }

            let city = await this.getCity(FDCarrier.state, FDCarrier.city, FDCarrier.zip_code.replace(/\D/g, ""));
            if(FDCarrier.address1){
              let newCarrierAddressDetails = {
                carrier_detail_id:carrierDetail.id,
                address: FDCarrier.address1, 
                contact: FDCarrier.contact_name1, 
                phone: FDCarrier.phone1, 
                use_for_print_check:true,
                zipcode_id: city.zipcode_id || null,
                city_id: city.id || null,
                state_id: city.state_id || null
              }
              let [carrierAddressDetails, isNewCarrierAddressDetails] = await RiteWay.CarrierAddressDetails.findOrCreate({
                defaults: newCarrierAddressDetails,
                where: {
                  carrier_detail_id: carrierDetail.id
                  },
                  ...optQuery
              });

              if (!isNewCarrierAddressDetails) {
                await carrierDetail.update(newCarrierAddressDetails, optQuery);
              }
              
              Logger.info(`YA CREADO CarrierAddressDetails of carrier ${carrierAddressDetails.id} was updated`);
            }

          }else{
            console.log("PUNTO 3");
            let city = await this.getCity(FDCarrier.state, FDCarrier.city, FDCarrier.zip_code.replace(/\D/g, ""));
            let newCarrier = {
              name: FDCarrier.company_name.trim(),
              photo: '',
              email: FDCarrier.email.trim().toLowerCase(),
              phone: FDCarrier.phone1 || '',
              address:FDCarrier.address1 || '',
              status:true,
              company_type_id:1,
              city_id: city.id,
              zipcode_id: city.zipcode_id,
              created_at: FDCarrier.create_date  || today,
              updated_at: FDCarrier.create_date || today,
              invoice_created_in: 'dispatch'
            }
              carrier = await RiteWay.Company.create(newCarrier, optQuery);
              let new_carrier_detail = {
                insurance_doc: `https://freightdragon.com//application/accounts/getdocs/id/${FDCarrier.insurance_doc_id}/type/1`,
                //hours_of_operation: FDCarrier.hours_of_operation,
                insurance_expire: FDCarrier.insurance_expirationdate,
                dispatcher_id: 848,
                insurance_iccmcnumber: FDCarrier.insurance_iccmcnumber,
                company_id: carrier.id
                
              }
              let [carrierDetail, isNewCarrierDetail] = await RiteWay.CarrierDetail.findOrCreate({
                defaults: new_carrier_detail,
                where: {
                      company_id: carrier.id
                  },
                  ...optQuery
              });
              if (!isNewCarrierDetail) {
                await carrierDetail.update(new_carrier_detail, optQuery);
            }

            if(FDCarrier.address1){
              let newCarrierAddressDetails = {
                carrier_detail_id:carrierDetail.id,
                address: FDCarrier.address1, 
                contact: FDCarrier.contact_name1, 
                phone: FDCarrier.phone1, 
                use_for_print_check:true,
                zipcode_id: city.zipcode_id || null,
                city_id: city.id || null,
                state_id: city.state_id || null
              }
              let [carrierAddressDetails, isNewCarrierAddressDetails] = await RiteWay.CarrierAddressDetails.findOrCreate({
                defaults: newCarrierAddressDetails,
                where: {
                  carrier_detail_id: carrierDetail.id
                  },
                  ...optQuery
              });

              if (!isNewCarrierAddressDetails) {
                await carrierDetail.update(newCarrierAddressDetails, optQuery);
              }
              
              Logger.info(`NO ESTABA CREADO CarrierAddressDetails of carrier ${carrierAddressDetails.id} was updated`);
            }
          }
          console.log("PUNTO 4");
          if (transaction) await transaction.commit();
          return true;
        } catch (error) {
          if (transaction) await transaction.rollback();
          Logger.info(`[Error] en creación del carrier`);
          Logger.error(error);
          throw error;
          return false;
        }
    }


    async importFDEntity(FDEntity, associateCompany = null) {
        let quote = await RiteWay.Quote.findOne({
            where: {
                [sqOp.or]: [
                    { fd_id: FDEntity.id },
                    { fd_number: FDEntity.FDOrderID }
                ]
            },
            paranoid: false
        });
        console.log("SEG BRO!");
        if (quote) {
            await quote.update({
                fd_id: FDEntity.id,
                fd_number: FDEntity.FDOrderID
            });

            await StageQuote.findOrCreate({
                where: {
                    fdOrderId: quote.fd_number
                },
                defaults: {
                    riteWayId: quote.id,
                    fdOrderId: FDEntity.FDOrderID,
                    fdAccountId: '',
                    fdResponse: 'Imported',
                    status: '',
                    watch: true
                }
            });
            Logger.info(`Quote exists ${FDEntity.FDOrderID}`);
            return false;
        }

        const transaction = await riteWayDBConn.transaction();
      try {
            let quoteData = await this.parseFDEntity(FDEntity, associateCompany);
            let isPaid = false;
            console.log("LLEGAMOS A UNO");
            if (typeof quoteData.company.id == 'undefined' || quoteData.company.id == null) {
                delete quoteData.company.id;
                let operator_id = quoteData.company.operator_id;
                let shipper_type = quoteData.company.shipper_type;
                let shipper_hours = quoteData.company.shipper_hours;
                if(quoteData.company.isNew && quoteData.company.name == "Residential"){

                }
                // let companyFoundResidential = await RiteWay.Company.findOne({
                //     where: {
                //         [sqOp.iLike]: [
                //             { name: 'Residential' }
                //         ],

                //     },
                //     include:{
                //         model: RiteWay.CustomerDetail,
                //         required: true,
                //         as: 'customerDetail',
                //         where:{
                //             operator_id: operator_id
                //         }
                //     },
                //     paranoid: false
                // });
                // if(!companyFoundResidential){
                   
                // }else{
                //     quoteData.company = companyFoundResidential;
                // }
                let [companyData , isNewCompany] = await RiteWay.Company.findOrCreate({
                    defaults: {
                        ...quoteData.company
                    },
                    where: {
                        name: {
                            [sqOp.iLike]: `${quoteData.company.name}`
                        }
                    },
                    transaction
                });
                quoteData.company = companyData;
                // quoteData.company = await RiteWay.Company.create(quoteData.company, { transaction });
                // console.log("lajshdlkasdn", quoteData.company);
                await RiteWay.CustomerDetail.create(
                {
                    operator_id: operator_id,
                    company_id: quoteData.company.id,
                    shipper_type: shipper_type,
                    hours: shipper_hours
                },
                { transaction }
                );
                
                
            }

            

            if (quoteData.user.isNew) {
              console.log("CREANDO EL USUARIO");
                quoteData.user = await this.getUser(
                    {
                        ...quoteData.user,
                        company_id: quoteData.company.id
                    },
                    quoteData.user.username,
                    { transaction });
            }            
            quoteData.residential_user_id = quoteData.user.id;
            if(quoteData.users.length > 0){
                // quoteData.users.forEach(async element => {
                //     delete element.company_id;
                //     await this.getUser(
                //         {
                //             ...element,
                //             company_id: quoteData.company.id
                //         },
                //         element.password,
                //         { transaction });
                // });
            }

            quoteData.company_id = quoteData.company.id;
            quoteData.user_create_id = quoteData.user.id;

            //Create Quote
            // console.log(quoteData);
            quote = await RiteWay.Quote.create(quoteData, { transaction });
            console.log("LLEGAMOS A DOS");
            await riteWayDBConn.query(
                'UPDATE quotes SET created_at = :created_at, updated_at = :updated_at, deleted_at = :deleted_at WHERE id = :id',
                {
                    replacements: { ...quoteData, id: quote.id },
                    type: Sequelize.QueryTypes.UPDATE,
                    transaction,
                    raw: true
                }
            );

            quoteData.id = quote.id;

            Logger.info(`Quote created ${quoteData.fd_number} with ID ${quote.id}, Company: ${quoteData.company.id}`);
            console.log(`----------------------------------> Quote created ${quoteData.fd_number} with ID ${quote.id}, Company: ${quoteData.company.id}`);
            if (quoteData.order) {
                quoteData.order.quote_id = quoteData.id;
                await this.importOrderData(quoteData.order, quote, { transaction });
                if (quoteData.order.invoice) isPaid = quoteData.order.invoice.is_paid
            }
            let total_notes = quoteData.notes.length;
            for (let i = 0; i < quoteData.notes.length; i++) {
                if( i < 40){
                    let note = quoteData.notes[i];
                    let newNote = await RiteWay.Note.create({
                        ...note,
                        quote_id: quoteData.id
                    }, { transaction });
                    Logger.info(`Note created  of ${quoteData.fd_number}, with ID ${newNote.id}`);
                }else{
                    break;
                }
            }
            for (let i = 0; i < quoteData.vehicles.length; i++) {
                let vehicleData = quoteData.vehicles[i];

                vehicleData.quote_id = quote.id;

                let newVehicle = await RiteWay.Vehicle.create(vehicleData, { transaction });
                Logger.info(`vehicle created ${newVehicle.id} of ${quoteData.fd_number}`);
            }

            let status = quoteData.order ? quoteData.order.status_id : quoteData.status_id;

            let watch = status != ORDER_STATUS.CANCELLED;
            watch = watch && !(status == ORDER_STATUS.DELIVERED && isPaid);
            console.log("LLEGAMOS A CINCO");
            
            let insertQuoteSummary = {
                total_notes: quoteData.notes.length, 
                total_vehicles: quoteData.vehicles.length,
                total_customer_notes: 0,
                quote_id: quote.id,
                vehicles_summary: quoteData.vehicles_summary
            };
            
            await RiteWay.QuoteSummary.findOrCreate({
                defaults: {
                    ...insertQuoteSummary
                },
                where: {
                    quote_id: quote.id
                },
                transaction 
            });
            // await StageQuote.create(stageQuoteData, { transaction });
            await transaction.commit();
            return true;
        }
        catch (error) {
            await transaction.rollback();
            console.log(error);
            Logger.error(`All changes was rollback of  ${FDEntity.FDOrderID}`);
            Logger.error(error);
            throw error;
        }
        return false;
    }

    //UPDATE DATA=========================================
    async sendEventSockect(typeEvent = 'quote', statuses, quote, is_paid = false) {
        try {
            let eventType = null;
            let typeAction = null;
            let operatorUser = quote.Company.customerDetail.operatorUser;
            let eventBody = {};

            this.addToken(operatorUser);

            if (typeEvent == 'quote') {
                eventType = EVENT_TYPES.quoteStatusChange(quote);
                typeAction = { action: 'updated', element: 'Quote' };
                eventBody = {
                    fd_number: quote.fd_number,
                    quote_id: quote.id,
                    newStatus: this.statusToSymbol[statuses.newStatusId],
                    previousStatus: this.statusToSymbol[statuses.previousStatusId],
                    company_id: quote.company_id
                };
            }
            else {
                eventType = EVENT_TYPES.orderStatusChange(quote);
                typeAction = { action: 'updated', element: 'Order' };
                eventBody = {
                    fd_number: quote.fd_number,
                    order_id: quote.orderInfo.id,
                    newStatus: this.statusToSymbol[statuses.newStatusId],
                    previousStatus: this.statusToSymbol[statuses.previousStatusId],
                    company_id: quote.company_id,
                    is_paid
                };
            }

            const params = buildBroadCastParams(eventType, quote, operatorUser, typeAction, "", eventBody);
            await broadcastEvent(params);
            Logger.info(`Send event ${quote.fd_number} `);
        }
        catch (error) {
            Logger.error(`Error event ${error.message} `);
            Logger.error(error);
        }

    }

    async sendNotes(quote, optQuery) {
        let notes = await RiteWay.Note.findAll({
            attributes: [
                'text',
                'showOnCustomerPortal',
                [Sequelize.literal("to_char(created_at::timestamp, 'YYYY-MM-DD HH24:MI:SS')"), 'createdAt']
            ],
            include: {
                model: RiteWay.User,
                required: true
            },
            where: {
                quote_id: quote.id
            },
            ...optQuery
        });

        if (notes.length > 0) {
            Logger.error(`${notes.length} Notes of ${quote.fd_number} will send to FD`);
            let rData = {
                FDOrderID: quote.fd_number,
                Notes: (new Buffer(JSON.stringify(notes.map(note => {
                    let data = {
                        sender: note.User.username,
                        sender_customer_portal: note.showOnCustomerPortal,
                        created: note.createdAt,
                        text: note.text
                    };
                    return data;
                })))).toString('base64'),
            };
            let res = await this.FDService.sendNotes(rData);
        }

        return true;
    }

    async updateVehicles(vehicles, quote, optQuery) {
        for (let i = 0; i < quote.vehiclesInfo.length; i++) {
            let rwVehicle = quote.vehiclesInfo[i];
            let updated = false;
            for (let j = 0; j < vehicles.length; j++) {

                let vehicle = vehicles[j];

                if ((rwVehicle.vin == vehicle.vin && rwVehicle.vin != null && rwVehicle.vin != '') ||
                    (
                        rwVehicle.year == vehicle.year
                        && rwVehicle.type_id == vehicle.type_id
                        && rwVehicle.model_id == vehicle.model_id
                    )) {

                    updated = true;
                    await rwVehicle.update(vehicle, optQuery);
                    vehicles.splice(j, 1);
                    break;
                }
            }

            /* if (!updated) {
                await rwVehicle.destroy(optQuery);
            } */
        }

        for (let vehicle of vehicles) {
            RiteWay.Vehicle.create({
                ...vehicle,
                quote_id: quote.id
            });
        }
    }

    async updateNotes(notes, quote, optQuery) {

        for (let i = 0; i < notes.length; i++) {
            let note = notes[i];
            note.quote_id = quote.id;
            await RiteWay.Note.findOrCreate({
                where: {
                    [sqOp.and]: [
                        Sequelize.where(
                            Sequelize.col('Note.quote_id'),
                            '=',
                            note.quote_id
                        ),
                        Sequelize.where(
                            Sequelize.col('Note.user_id'),
                            '=',
                            note.user_id
                        ),
                        Sequelize.where(
                            Sequelize.col('Note.created_at'),
                            '=',
                            note.createdAt
                        )
                    ]
                },
                defaults: {
                    ...note,
                    createdAt: `${note.createdAt} UTC`
                },
                ...optQuery
            });
        }

        let notesAmount = await RiteWay.Note.count({
            where: {
                quote_id: quote.id
            },
            ...optQuery
        });


        try {
            if (notesAmount != notes.length) {

                this.sendNotes(quote, optQuery);
            }
        }
        catch (error) {
            Logger.error(`It was not possible sent notes of ${quote.fd_number} to FD`);
        }
    }

    async updateRWOrder(orderData, quote, optQuery) {
        let order;
        if (quote.orderInfo) {
            order = quote.orderInfo;

            if (Array.isArray(orderData.status_id)) {
                if (!orderData.status_id.includes(quote.orderInfo.status_id)) {
                    orderData.status_id = orderData.status_id[0];
                }
                else {
                    orderData.status_id = quote.orderInfo.status_id;
                }
            }

            await quote.orderInfo.update({ ...orderData, quote_id: quote.id }, optQuery);
            Logger.info(`Order of Quote ${quote.fd_number} Updated with ID ${quote.orderInfo.id}, Company: ${quote.Company.id}`);
        }
        else if (orderData) {
            orderData.quote_id = quote.id;
            await this.importOrderData(orderData, quote, optQuery);
            Logger.info(`Order of Quote ${quote.fd_number} Created, Company: ${quote.Company.id}`);

            order = await RiteWay.Order.findOne({
                where: {
                    quote_id: quote.id
                },
                ...optQuery
            })
        }

        if (order) {
            if (orderData.carrier) {
                await this.importCarrierDriver(orderData.carrier, orderData.driver, order, quote, optQuery);
            }

            await RiteWay.Payment.destroy({
                where: {
                    order_id: order.id
                },
                ...optQuery
            });

            if (orderData.payments) {
                for (let i = 0; i < orderData.payments.length; i++) {
                    let paymentData = orderData.payments[i];

                    let payment = await RiteWay.Payment.create({
                        ...paymentData,
                        order_id: order.id
                    }, optQuery);

                    await riteWayDBConn.query(
                        'UPDATE payments SET created_at = :created_at, updated_at = :updated_at WHERE id = :id',
                        {
                            ...optQuery,
                            replacements: { ...paymentData, id: payment.id },
                            type: Sequelize.QueryTypes.UPDATE,
                            raw: true
                        }
                    );
                    Logger.info(`Payment of ${quote.fd_number} created ${payment.id}`);
                }
            }

            if (orderData.invoice) {
                let invoiceData = {
                    ...orderData.invoice,
                    order_id: order.id
                };

                let [invoice, invoiceCreated] = await RiteWay.Invoice.findOrCreate({
                    where: {
                        order_id: order.id
                    },
                    defaults: invoiceData,
                    ...optQuery
                });

                if (invoiceCreated) {
                    Logger.info(`Invoice of ${quote.fd_number} created ${invoice.id}`);
                }
                else {
                    await invoice.update(invoiceData, optQuery);
                    Logger.info(`Invoice of ${quote.fd_number} updated ${invoice.id}`);
                }
            }
        }
    }

    async updateRWEntity(FDEntity, quote) {
        const transaction = undefined;
        try {
            Logger.info(`UPDATING ${quote.fd_number} with ID ${quote.id} (${quote.status_id}), Company: ${quote.Company.id}`);

            let quoteData = await this.parseFDEntity(FDEntity, quote.Company);
            let optQuery = { transaction, paranoid: false };

            if (quote.status_id == QUOTE_STATUS.WAITING || quote.status_id == QUOTE_STATUS.OFFERED) {
                await quote.reload({
                    include: this.quoteIncludeData(),
                    ...optQuery
                });
            }

            let quoteTariff = await quote.vehiclesInfo.map(vehicle => vehicle.tariff).reduce((accumulator, tariff) => accumulator + (tariff ? Number(tariff) : 0));
            let fdTariff = Number(FDEntity.tariff);
            let updateFD = quoteTariff != fdTariff;
            let isPaid = false;

            if (updateFD && quote.status_id != QUOTE_STATUS.ORDERED) {
                let response = await this.FDService.update(quote.fd_number, quote);
                if (response.Success) {
                    response = await this.FDService.get(quote.fd_number);
                    if (response.Success) quoteData = await this.parseFDEntity(response.Data, quote.Company);
                }
            }

            //Updated Quote
            if (quote.status_id > quoteData.status_id) quoteData.status_id = quote.status_id;
            let quoteStatuses = { newStatusId: quoteData.status_id, previousStatusId: quote.status_id };
            let orderStatuses = undefined;

            if (quote.deletedAt) quoteData.deleted_at = quote.deletedAt;

            await quote.update(quoteData, optQuery);

            await riteWayDBConn.query(
                'UPDATE quotes SET created_at = :created_at, updated_at = :updated_at, deleted_at = :deleted_at WHERE id = :id',
                {
                    replacements: { ...quoteData, id: quote.id },
                    type: Sequelize.QueryTypes.UPDATE,
                    transaction,
                    raw: true
                }
            );
            await quote.reload(optQuery);
            Logger.info(`Quote Updated ${quote.fd_number} with ID ${quote.id} (${quote.status_id}), Company: ${quote.Company.id}`);

            if (quoteData.order) {
                if (quote.orderInfo) {
                    orderStatuses = { newStatusId: quoteData.order.status_id, previousStatusId: quote.orderInfo.status_id };
                }
                await this.updateRWOrder(quoteData.order, quote, optQuery);
                if (quoteData.order.invoice) isPaid = quoteData.order.invoice.is_paid
            }

            await this.updateVehicles(quoteData.vehicles, quote, optQuery);
            Logger.info(`Vechiles of Quote ${quote.fd_number} Updated`);
            await this.updateNotes(quoteData.notes, quote, optQuery);
            Logger.info(`Notes of Quote ${quote.fd_number} Updated`);

            let status = quoteData.order ? quoteData.order.status_id : quoteData.status_id;

            let watch = status != ORDER_STATUS.CANCELLED;
            watch = watch && !(status == ORDER_STATUS.DELIVERED && isPaid);

            let stageQuoteData = {
                riteWayId: quote.id,
                fdOrderId: FDEntity.FDOrderID,
                fdAccountId: '',
                fdResponse: `Updated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`,
                status: status,
                watch: watch,
                ordered: quoteData.status_id == QUOTE_STATUS.ORDERED
            };

            await quote.stage_quote.update(stageQuoteData, optQuery);
            Logger.info(`${FDEntity.FDOrderID} updated whatch: ${watch}`);


            //SEND EVENT
            if (quoteStatuses.newStatusId != quoteStatuses.previousStatusId) {
                await this.sendEventSockect('quote', quoteStatuses, quote);
            }
            if (orderStatuses) {
                if (orderStatuses.newStatusId != orderStatuses.previousStatusId || (orderStatuses.newStatusId == ORDER_STATUS.DELIVERED && isPaid)) {
                    await this.sendEventSockect('order', quoteStatuses, quote, isPaid);
                }
            }

            if (transaction) await transaction.commit();

            return true;
        }
        catch (error) {
            if (transaction) await transaction.rollback();
            await quote.stage_quote.update({
                fdResponse: `ERROR: ${error.message}`,
                status: quote.status_id,
                watch: true
            }, { paranoid: false });
            Logger.error(`All changes was rollback of  ${FDEntity.FDOrderID}`);
            Logger.error(error);
        }
        return false;
    }

    //SEND FILES=========================================
    /* async syncFiles(res, riteWayQuote) {
        let FDEntity = res.Data;
        let fdFiles = (res.Success ? res.Data.files : []);
        let hashFiles = {};
        let filesToFD = [];
        let filesToRW = [];
        let folder = `tmp/quote_${riteWayQuote.id}`

        riteWayQuote.orderInfo.orderDocuments.forEach(rwFile => {
            hashFiles[rwFile.name] = {
                existIn: 'rw',
                url: RWAConf.host + rwFile.urlFile,
                name: rwFile.name
            };
        });

        riteWayQuote.vehicles.forEach(vehicle => {
            let fileName = null;
            if (vehicle.gatePass != null && vehicle.gatePass != '') {
                fileName = path.basename(vehicle.gatePass);
            }

            if (fileName != null) {
                hashFiles[fileName] = {
                    existIn: 'rw',
                    url: RWAConf.host + vehicle.gatePass,
                    name: fileName
                };
            }
        });

        //BOL
        if (riteWayQuote.orderInfo.bol != null && riteWayQuote.orderInfo.bol != '') {
            let bolFileName = path.basename(riteWayQuote.orderInfo.bol);
            hashFiles[bolFileName] = {
                existIn: 'rw',
                url: RWAConf.host + riteWayQuote.orderInfo.bol,
                name: bolFileName
            };
        }

        //FD Files
        fdFiles.forEach(fdFile => {
            if (typeof hashFiles[fdFile.name_original] == 'undefined') {
                hashFiles[fdFile.name_original] = {
                    existIn: 'fd',
                    url: FDConf.host + fdFile.url,
                    name: fdFile.name_original
                };
            }
            else {
                hashFiles[fdFile.name_original].existIn = 'both'
            }
        });

        let files = Object.values(hashFiles);

        let gatePassesFileFromFD = files.filter(file => file.existIn == 'fd' && file.name.indexOf('gate_pass_') == 0);
        let bolFileFromFD = files.filter(file => file.existIn == 'fd' && file.name.indexOf('bol_') == 0);

        files = files.filter(file => file.existIn != 'both' && file.name.indexOf('gate_pass_') == -1 && file.name.indexOf('bol_') == -1);

        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            let dFilePath = await HTTPService.downloadFile(file.url, folder, file.name);
            if (dFilePath) {
                file.path = dFilePath;
                try {
                    if (file.existIn == 'rw') {
                        await this.FDService.sendFiles(FDEntity.FDOrderID, file);
                    }
                    else {
                        await this..uploadDocument(riteWayQuote.orderInfo.id, file);
                    }
                }
                catch (error) {
                    Logger.error('Error when the system try sync documents files, filename: ' + file.name + ' of ' + file.existIn);
                }

            }
        };

        //Upload BOL
        if (bolFileFromFD.length > 0) {
            try {
                await this..uploadBOL(riteWayQuote.orderInfo.id, bolFileFromFD[0]);
            }
            catch (error) {
                Logger.error('Error when the system try sync BOL file, filename: ' + bolFileFromFD[0].name + ' of ' + bolFileFromFD[0].existIn);
            }
        }
    } */
    async syncInvoiceFlow(quote, orderId, invoice) {
        try {
            
            let fdInvoiceURL = (invoice.invoice_url ? FDConf.host + invoice.invoice_url : null);
            let folder = `tmp/quote_${quote.id}/invoice`;
             
            if (fdInvoiceURL) {
                let fileName = path.basename(fdInvoiceURL);
                let filePath = await HTTPService.downloadFile(fdInvoiceURL, folder, fileName);
                if (filePath) {
                    let companyFolder = 'company_' + quote.company_id;
                    let invoiceFolder = 'order_' + orderId + '/invoice';
                    let s3Path = `${companyFolder}/${invoiceFolder}/${fileName}`;

                    await this.uploadToS3(filePath, s3Path);
                    fs.unlinkSync(filePath);
                    Logger.info(`Invoice file of ${quote.fd_number} synchronized`);
                    return `${s3Path}`;                    
                }
            }
        }
        catch (error) {
            Logger.error(`Error when the system upload invoice file of ${quote.fd_number} on Rite Way System`);
            Logger.error(error);
            let contentFile = `${FDEntity.FDOrderID}: ${error.message} </br> ------------------- ${JSON.stringify(error)} ----------------------------- Final de la entidad -----------------------------`;
            let appFolder = path.dirname(require.main ? require.main.filename : __dirname);
            fs.writeFile(`${appFolder}/logs_sync_files/debugger-${quote.fd_number}.txt`, `${contentFile} \n \n \n \n \n`, { flag: 'a+' }, err => {
                //console.log("ERROR EN MI debugger.txt", err);
            })
        }
    }

    async syncInvoice(quote) {
        try {
            let res = await this.FDService.get(quote.fd_number, true) || {};

            if (!res.Success) {
                return false;
            }
            
            let fdInvoiceURL = (res.Data.invoice_file ? FDConf.host + res.Data.invoice_file : null);
            let folder = `tmp/quote_${quote.id}/invoice`;
             
            if (fdInvoiceURL) {
                let fileName = path.basename(fdInvoiceURL);
                let filePath = await HTTPService.downloadFile(fdInvoiceURL, folder, fileName);
                if (filePath) {
                    let companyFolder = 'company_' + quote.Company.id;
                    let invoiceFolder = 'order_' + quote.orderInfo.id + '/invoice';
                    let s3Path = `${companyFolder}/${invoiceFolder}/${fileName}`;

                    await this.uploadToS3(filePath, s3Path);
                    // console.log("asdasd", quote.orderInfo.invoiceInfo[0].id, quote.orderInfo.invoiceInfo[0]);
                    let update_invoices = {
                        invoice_url: `${s3Path}`,
                        invoice_type_id: INVOICE_TYPES.CUSTOMER,
                        id: quote.orderInfo.invoiceInfo.id
                    }
                    // await riteWayDBConn.query(
                    //     'UPDATE invoices SET invoice_url = :invoice_url, invoice_type_id = :invoice_type_id WHERE id = :id',
                    //     {
                    //         replacements: { ...update_invoices },
                    //         type: Sequelize.QueryTypes.UPDATE,
                    //         raw: true
                    //     }
                    // );
                    await quote.orderInfo.invoiceInfo[0].update({
                        invoice_url: `${s3Path}`,
                        invoice_type_id: INVOICE_TYPES.CUSTOMER
                    });
                    fs.unlinkSync(filePath);
                    Logger.info(`Invoice file of ${quote.fd_number} synchronized`);
                }
            }
        }
        catch (error) {
            Logger.error(`Error when the system upload invoice file of ${quote.fd_number} on Rite Way System`);
            Logger.error(error);
            let contentFile = `${FDEntity.FDOrderID}: ${error.message} </br> ------------------- ${JSON.stringify(error)} ----------------------------- Final de la entidad -----------------------------`;
            let appFolder = path.dirname(require.main ? require.main.filename : __dirname);
            fs.writeFile(`${appFolder}/logs_sync_files/debugger-${quote.fd_number}.txt`, `${contentFile} \n \n \n \n \n`, { flag: 'a+' }, err => {
                //console.log("ERROR EN MI debugger.txt", err);
            })
        }
    }

    async syncDispatchSheet(order) {
        try {
            let res = await this.FDService.syncDispatchSheet(order.fd_number) || {};

            if (!res.Success) {
                return false;
            }
            console.log("..................................................", order.fd_number);

            if(res.Data[0][0].files.length > 0){
                let FDOrderID = res.Data[0][0].FDOrderID;
                res.Data[0][0].files.forEach(archivo => {
                    let name_original = archivo.name_original;
                    archivo.FDOrderID = FDOrderID;
                    if(name_original.startsWith('B2B Order Form')){
                        this.loadFile(archivo, "b2b", order);
                    }

                    if(name_original.startsWith('Dispatch sheet')){
                        this.loadFile(archivo, "dispatchsheet", order);
                    }
                });
            }

            
        }
        catch (error) {
            console.log("ERROR EN syncDispatchSheet DE LA CLASE RiteWayAutotranportSyncService", error);
        }
    }

    async loadFile(data, type = "dispatchsheet", obj = {}, optQuery = {}){
        try{
            let fdInvoiceURL = `https://freightdragon.com/uploads/entity/${data.name_on_server}`; 
            let name_original = `${data.name_original}`;
            let folder = `tmp/quote_${obj.quote_id}/${type}`;
            if (fdInvoiceURL) {
                let fileName = path.basename(fdInvoiceURL);
                let filePath = await HTTPService.downloadFile(fdInvoiceURL, folder, fileName);
                if (filePath) {
                    console.log("SE DESCARGÓ EL ARCHIVO ", obj.order_id);
                    const s3Path = `company_${obj.company_id}/order_${obj.order_id}/order_documents/${type}/${name_original}`;

                    await this.uploadToS3(filePath, s3Path);
                    let name = type == 'dispatchsheet' ? 'Dispatch sheet' : 'b2b';
                    let dataDocument = {
                        name,
                        url_file: s3Path,
                        uploaded_at: moment(),
                        order_id: obj.order_id
                    };
                  
                  
                    await RiteWay.OrderDocument.findOrCreate({
                        defaults: {
                            ...dataDocument
                        },
                        where: {
                            name: dataDocument.name,
                            order_id: dataDocument.order_id
                        },
                        ...optQuery
                    });;
                    fs.unlinkSync(filePath);
                    Logger.info(`${type} file of ${obj.fd_number} synchronized`);
                }
            }
        }catch (error) {
            Logger.error(`Error when the system upload ${type} file of ${data.FDOrderID} on Rite Way System`);
            Logger.error(error);
            let contentFile = `${FDEntity.FDOrderID}: ${error.message} </br> ------------------- ${JSON.stringify(error)} ----------------------------- Final de la entidad -----------------------------`;
            let appFolder = path.dirname(require.main ? require.main.filename : __dirname);
            fs.writeFile(`${appFolder}/logs_sync_files_${type}/debugger-${data.FDOrderID}.txt`, `${contentFile} \n \n \n \n \n`, { flag: 'a+' }, err => {
                //console.log("ERROR EN MI debugger.txt", err);
            })
        }
    }


    async updateOrdersData(order, show_data) {
        try {
            let customer_balance_paid_by = [
                '',
                14,
                4,
                11,
                9,
                9,
                13
            ]
                // this.response.customer_balance_paid_by = {}
                
                // this.response.customer_balance_paid_by.error = 0;
                // this.response.customer_balance_paid_by.error_arr= [];

                // this.response.customer_balance_paid_by.different++;
                // this.response.customer_balance_paid_by.different_arr;

                // this.response.customer_balance_paid_by.igual= 0;
                // this.response.customer_balance_paid_by.new=0;
            let res = await this.FDService.updateOrdersData(order.fd_number) || {};

            if (!res.Success) {
                return false;
            }
            let payment_method_id = null;
            let update_order =  {};
            if(res.Data.customer_balance_paid_by){
                let customer_balance_paid_by_num = Number(res.Data.customer_balance_paid_by);
                
                if(customer_balance_paid_by_num < 7){
                    if(order.payment_method_id==customer_balance_paid_by[customer_balance_paid_by_num]){
                        this.response.customer_balance_paid_by.igual++;
                        payment_method_id = order.payment_method_id;
                    }else{
                        this.response.customer_balance_paid_by.new++;
                        payment_method_id = customer_balance_paid_by[customer_balance_paid_by_num];
                    }
                }else{
                    payment_method_id = 9;
                    this.response.customer_balance_paid_by.different++;
                    this.response.customer_balance_paid_by.different_arr.push(`${order.fd_number} -> ${customer_balance_paid_by_num}`);
                }
            }else{
                this.response.customer_balance_paid_by.error++;
                this.response.customer_balance_paid_by.error_arr.push(order.fd_number);
            }

            if(res.Data.domain){
                const sourceInfo = await riteWayDBConn.query(`SELECT * FROM sources          
                                                    where sources."name" ilike  '%${res.Data.domain}%'`, {
                    type: Sequelize.QueryTypes.SELECT
                });
              if(sourceInfo[0]){
                  console.log("Se encontró el source ID");
                update_order.source_id = sourceInfo[0].id
              }else{
                update_order.source_id = -1
              }
            }else{
                console.log("Vino null y es ",order.fd_number);
                update_order.source_id = -1
            }
            update_order.payment_method_id = payment_method_id;
            update_order.id = order.id;
            let sql_update = await riteWayDBConn.query(
                        'UPDATE orders SET source_id = :source_id, payment_method_id = :payment_method_id WHERE id = :id',
                        {
                            replacements: { ...update_order },
                            type: Sequelize.QueryTypes.UPDATE,
                            raw: true
                        }
                    );
            // console.log(sql_update);
            if(show_data){
                console.log("FINAAAAL");
                console.log(this.response);
            }          
        }
        catch (error) {
            console.log("ERROR EN updateOrdersData DE LA CLASE RiteWayAutotranportSyncService", error);
        }
    }

    


    
}

module.exports = RiteWayAutotranportSyncService;