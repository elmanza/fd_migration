const moment = require('moment');

const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const { RiteWay, Stage } = require("../../../models");
const { StageQuote, OperatorUser } = Stage;
const { ritewayDB: riteWayDBConn } = require('../../../config/database');

const path = require('path');
const Crypter = require('../../../utils/crypter');
const Logger = require('../../../utils/logger');

const { FDConf, RWAConf } = require('../../../config');
const FreightDragonService = require('../../freight_dragon/services/FreightDragonService');
const HTTPService = require('../../../utils/HTTPService');
const RiteWayAutotranportService = require('./RiteWayAutotransportService');
const { ORDER_STATUS, QUOTE_STATUS } = require('../../../utils/constants');

class RiteWayAutotranportSyncService extends RiteWayAutotranportService {
    constructor() {
        super();
        this.FDService = new FreightDragonService();
        this.RWService = new RiteWayAutotranportService();
        this.httpService = new HTTPService();
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
                    company_id: carrierData.id
                },
                driverData.username,
                optQuery);

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
            }
        });
        if (quote) {
            await StageQuote.findOrCreate({
                where: {
                    fdOrderId: FDEntity.FDOrderID
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
                watch: false,
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

    async sendNotes(quote, optQuery) {
        let notes = await RiteWay.Note.findAll({
            attributes: [
                'text',
                'showOnCustomerPortal',
                [Sequelize.literal("to_char(created_at::timestamp, 'YYYY-MM-DD HH:mm:ss')"), 'createdAt']
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

        let notesAmount = await RiteWay.Note.count({
            where: {
                quote_id: quote.id
            },
            ...optQuery
        });

        if (notesAmount == notes.length) return true;

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
                defaults: note,
                ...optQuery
            });
        }

        try {
            this.sendNotes(quote, optQuery);
            Logger.error(`Notes of ${quote.fd_number} was sended to FD`);
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
            let quoteTariff = await quote.vehiclesInfo.map(vehicle => vehicle.tariff).reduce((accumulator, tariff) => accumulator + (tariff ? Number(tariff) : 0));
            let fdTariff = Number(FDEntity.tariff);
            let updateFD = quoteTariff != fdTariff;
            let isPaid = false;

            if (updateFD && quoteData.status_id != QUOTE_STATUS.ORDERED) {
                let response = await this.FDService.update(quote.fd_number, quote);
                if (response.Success) {
                    response = await this.FDService.get(quote.fd_number);
                    if (response.Success) quoteData = await this.parseFDEntity(response.Data, quote.Company);
                }
            }

            //Updated Quote
            await quote.update(quoteData, { transaction, paranoid: false });

            await riteWayDBConn.query(
                'UPDATE quotes SET created_at = :created_at, updated_at = :updated_at, deleted_at = :deleted_at WHERE id = :id',
                {
                    replacements: { ...quoteData, id: quote.id },
                    type: Sequelize.QueryTypes.UPDATE,
                    transaction,
                    raw: true
                }
            );
            await quote.reload({ transaction, paranoid: false });
            Logger.info(`Quote Updated ${quote.fd_number} with ID ${quote.id} (${quote.status_id}), Company: ${quote.Company.id}`);

            if (quoteData.order) {
                await this.updateRWOrder(quoteData.order, quote, { transaction, paranoid: false });
                if (quoteData.order.invoice) isPaid = quoteData.order.invoice.is_paid
            }

            await this.updateVehicles(quoteData.vehicles, quote, { transaction });
            Logger.info(`Vechiles of Quote ${quote.fd_number} Updated`);
            await this.updateNotes(quoteData.notes, quote, { transaction });
            Logger.info(`Notes of Quote ${quote.fd_number} Updated`);

            let status = quoteData.order ? quoteData.order.status_id : quoteData.status_id;

            let watch = status != ORDER_STATUS.CANCELLED;
            watch = watch && !(status == ORDER_STATUS.DELIVERED && isPaid);

            let stageQuoteData = {
                riteWayId: quote.id,
                fdOrderId: FDEntity.FDOrderID,
                fdAccountId: '',
                fdResponse: 'Updated',
                status: status,
                watch: watch,
                ordered: quoteData.status_id == QUOTE_STATUS.ORDERED
            };

            await quote.stage_quote.update(stageQuoteData, { transaction });
            Logger.info(`${FDEntity.FDOrderID} updated whatch: ${watch}`);
            await transaction.commit();

            return true;
        }
        catch (error) {
            await transaction.rollback();
            Logger.error(`All changes was rollback of  ${FDEntity.FDOrderID}`);
            Logger.error(error);
        }
        return false;
    }

    //SEND FILES=========================================
    async syncFiles(res, riteWayQuote) {
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
                        await this.RWService.uploadDocument(riteWayQuote.orderInfo.id, file);
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
                await this.RWService.uploadBOL(riteWayQuote.orderInfo.id, bolFileFromFD[0]);
            }
            catch (error) {
                Logger.error('Error when the system try sync BOL file, filename: ' + bolFileFromFD[0].name + ' of ' + bolFileFromFD[0].existIn);
            }
        }
    }

    async syncInvoice(FDEntity, riteWayQuote) {
        let res = await this.FDService.get(FDEntity.FDOrderID, true);

        let invoice = await RiteWay.Invoice.findOne({
            where: {
                order_id: riteWayQuote.orderInfo.id
            }
        });

        if (invoice == null || !res.Success) {
            return;
        }

        let fdInvoiceURL = (res.Data.invoice_file ? FDConf.host + res.Data.invoice_file : null);
        let folder = `tmp/quote_${riteWayQuote.id}/invoice`;
        if (fdInvoiceURL) {
            let fileName = path.basename(fdInvoiceURL);
            let filePath = await HTTPService.downloadFile(fdInvoiceURL, folder, fileName);
            if (filePath) {
                let fileData = {
                    name: fileName,
                    path: filePath
                };

                try {
                    await this.RWService.uploadInvoice(invoice.id, fileData);
                }
                catch (error) {
                    Logger.error("Error when the system upload invoice file on Rite Way System, File " + fileName);
                    Logger.error(error);
                }

            }
        }
    }


    //Add Notes---------------------------------------------------------
    async sendNotes(quote) {
        let notes = await RiteWay.Note.findAll({
            attributes: [
                'text',
                'showOnCustomerPortal',
                [Sequelize.literal("to_char(created_at::timestamp, 'YYYY-MM-DD HH:mm:ss')"), 'createdAt']
            ],
            include: {
                model: RiteWay.User,
                required: true
            },
            where: {
                quote_id: quote.id
            }
        });

        if (notes.length > 0) {
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
    }
}

module.exports = RiteWayAutotranportSyncService;