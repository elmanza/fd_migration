const moment = require('moment');

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
        let carrier;
        if (typeof carrierData.id == 'undefined') {
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
            carrier = await RiteWay.Company.findByPk(carrierData.id);
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
        let originLocation = await RiteWay.Location.create(orderData.originLocation, optQuery);
        let destinationLocation = await RiteWay.Location.create(orderData.destinationLocation, optQuery);

        await RiteWay.ContactInformation.create({
            ...orderData.originLocation.contact_information,
            location_id: originLocation.id
        }, optQuery);

        await RiteWay.ContactInformation.create({
            ...orderData.destinationLocation.contact_information,
            location_id: destinationLocation.id
        }, optQuery);

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

        if (orderData.carrier) {
            await this.importCarrierDriver(orderData.carrier, orderData.driver, order, quote, optQuery);
        }

        if (orderData.payments) {
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

        if (orderData.invoice) {
            let invoice = await RiteWay.Invoice.create({
                ...orderData.invoice,
                order_id: orderData.id
            }, optQuery);
            Logger.info(`Invoice of ${quote.fd_number} created ${invoice.id}`);
        }
    }

    async importFDEntity(FDEntity, associateCompany = null) {
        let quote = await RiteWay.Quote.findOne({
            where: {
                fd_id: FDEntity.id
            },
            paranoid: false
        });
        if (quote) {
            await StageQuote.findOrCreate({
                where: {
                    fdOrderId: quote.fd_number
                },
                defaults: {
                    riteWayId: quote.id,
                    fdOrderId: quote.fd_number,
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

            if (typeof quoteData.company.id == 'undefined') {
                quoteData.company = await RiteWay.Company.create(quoteData.company, { transaction });
            }

            if (typeof quoteData.user.id == 'undefined') {
                quoteData.user = await this.getUser(
                    {
                        ...quoteData.user,
                        company_id: quoteData.company.id
                    },
                    quoteData.user.username,
                    { transaction });
            }

            quoteData.company_id = quoteData.company.id;
            quoteData.user_create_id = quoteData.user.id;

            //Create Quote
            quote = await RiteWay.Quote.create(quoteData, { transaction });

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

            if (quoteData.order) {
                quoteData.order.quote_id = quoteData.id;
                await this.importOrderData(quoteData.order, quote, { transaction });
                if (quoteData.order.invoice) isPaid = quoteData.order.invoice.is_paid
            }

            for (let i = 0; i < quoteData.notes.length; i++) {
                let note = quoteData.notes[i];
                let newNote = await RiteWay.Note.create({
                    ...note,
                    quote_id: quoteData.id
                }, { transaction });
                Logger.info(`Note created  of ${quoteData.fd_number}, with ID ${newNote.id}`);
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

            let stageQuoteData = {
                riteWayId: quote.id,
                fdOrderId: FDEntity.FDOrderID,
                fdAccountId: '',
                fdResponse: 'Imported',
                status: status,
                watch,
                ordered: quoteData.status_id == QUOTE_STATUS.ORDERED
            };
            await StageQuote.create(stageQuoteData, { transaction });
            await transaction.commit();
            return true;
        }
        catch (error) {
            await transaction.rollback();
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
                    newStatus: orderData.status_id,
                    previousStatus: quote.orderInfo.status_id,
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

                if ((rwVehicle.vin == vehicle.vin && rwVehicle.vin != null && rwVehicle.vin == '') ||
                    (
                        rwVehicle.year == vehicle.year
                        && rwVehicle.type_id == vehicle.type_id
                        && rwVehicle.model_id == vehicle.model_id
                    )) {

                    updated = true;
                    await rwVehicle.update(vehicle, optQuery);
                    vehicles.splice(j, 1);
                }
            }

            if (!updated) {
                await rwVehicle.destroy(optQuery);
            }
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
                ...optQuery,
                logging: true
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
        const transaction = await riteWayDBConn.transaction();
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
            let quoteStatuses = { newStatusId: quoteData.status_id, previousStatusId: quote.status_id };
            let orderStatuses = undefined;

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

            await transaction.commit();

            return true;
        }
        catch (error) {
            await transaction.rollback();
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

    async syncInvoice(quote) {
        try {
            let res = await this.FDService.get(quote.fd_number, true);

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
                    await quote.orderInfo.invoiceInfo.update({
                        invoice_url: `uploads/${s3Path}`,
                        invoice_type_id: INVOICE_TYPES.CUSTOMER
                    });
                    Logger.info(`Invoice file of ${quote.fd_number} synchronized`);
                }
            }
        }
        catch (error) {
            Logger.error(`Error when the system upload invoice file of ${quote.fd_number} on Rite Way System`);
            Logger.error(error);
        }
    }
}

module.exports = RiteWayAutotranportSyncService;