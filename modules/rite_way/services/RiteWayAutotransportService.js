const moment = require('moment');

const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;

const { RiteWay, Stage } = require("../../../models");
const { StageQuote, OperatorUser } = Stage;

const { QUOTE_STATUS, ORDER_STATUS, FD_STATUS, ADDRESS_TYPE, COMPANY_TYPES, ROLES, INVOICE_TYPES } = require('../../../utils/constants');
const { SyncConf } = require('../../../config');
const Crypter = require('../../../utils/crypter');
const S3 = require('../../../utils/S3');
const Logger = require('../../../utils/logger');

const OrderResource = require('./http/resources/OrderResource');
const InvoiceResource = require('./http/resources/InvoiceResource');

class RiteWayAutotranportService {
    constructor() {
        this.orderResource = new OrderResource();
        this.invoiceResource = new InvoiceResource();
    }

    _parseStatus(fdStatus, isOrder = false) {
        let validStatusQuote = {
            [FD_STATUS.LEAD]: [QUOTE_STATUS.WAITING, QUOTE_STATUS.OFFERED],
            [FD_STATUS.CANCELLED]: ORDER_STATUS.CANCELLED,
        };

        let validStatusOrder = {
            [FD_STATUS.ACTIVE]: ORDER_STATUS.ACTIVE,
            [FD_STATUS.ONHOLD]: ORDER_STATUS.ONHOLD,
            [FD_STATUS.CANCELLED]: ORDER_STATUS.CANCELLED,
            [FD_STATUS.POSTED]: ORDER_STATUS.POSTED,
            [FD_STATUS.NOTSIGNED]: [ORDER_STATUS.NOTSIGNED, ORDER_STATUS.SIGNED],
            [FD_STATUS.DISPATCHED]: ORDER_STATUS.DISPATCHED,
            [FD_STATUS.ISSUES]: ORDER_STATUS.DELIVERED,
            [FD_STATUS.PICKEDUP]: [ORDER_STATUS.PICKEDUP, ORDER_STATUS.INTRANSIT_DELAY, ORDER_STATUS.INTRANSIT_ONTIME],
            [FD_STATUS.DELIVERED]: ORDER_STATUS.DELIVERED,
        };

        if (isOrder) {
            return validStatusQuote[fdStatus] || QUOTE_STATUS.WAITING;
        }
        else {
            return validStatusOrder[fdStatus] || ORDER_STATUS.ACTIVE;
        }
    }

    quoteIncludeData(necesaryStage = true) {
        return [
            {
                model: RiteWay.Company,
                required: true,
                include: [{
                    model: RiteWay.CustomerDetail,
                    required: true,
                    as: 'customerDetail',
                    include: {
                        model: RiteWay.User,
                        required: true,
                        as: 'operatorUser',
                        attributes: ['id', 'name', 'last_name', 'username', 'last_name', 'company_id'],
                    }
                }]
            },
            {
                model: RiteWay.User,
                as: 'userCreate',
                required: false,
                attributes: ['id', 'name', 'last_name', 'username', 'last_name', 'company_id'],
                include: {
                    model: RiteWay.Company,
                    required: true
                }
            },
            {
                model: RiteWay.Order,
                as: 'orderInfo',
                include: [
                    {
                        model: RiteWay.Location,
                        as: 'orderOriInfo',
                        include: [
                            {
                                model: RiteWay.ContactInformation
                            },
                            {
                                model: RiteWay.AddressType,
                                as: 'addressTypeInfo'
                            }
                        ]
                    },
                    {
                        model: RiteWay.Location,
                        as: 'orderDesInfo',
                        include: [
                            {
                                model: RiteWay.ContactInformation
                            },
                            {
                                model: RiteWay.AddressType,
                                as: 'addressTypeInfo'
                            }
                        ]
                    }
                ],
                paranoid: false
            },
            {
                model: RiteWay.GisCity,
                required: true,
                as: 'originCityInfo',
                attributes: ['id', 'name', 'state_id'],
                include: {
                    model: RiteWay.State,
                    as: 'stateInfo',
                    attributes: ['id', 'abbreviation']
                }
            },
            {
                model: RiteWay.GisCity,
                required: true,
                as: 'destinationCityInfo',
                attributes: ['id', 'name', 'state_id'],
                include: [
                    {
                        model: RiteWay.State,
                        as: 'stateInfo',
                        attributes: ['id', 'abbreviation']
                    }
                ]
            },
            {
                model: RiteWay.Vehicle,
                as: 'vehiclesInfo',
                required: true,
                include: [
                    {
                        model: RiteWay.VehicleModel,
                        attributes: ['name'],
                        include: [{
                            model: RiteWay.VehicleMaker,
                            attributes: ['name']
                        }],
                        require: true
                    },
                    {
                        model: RiteWay.VehicleType,
                        attributes: ['name'],
                    }
                ]
            },
            {
                model: StageQuote,
                as: 'stage_quote',
                required: necesaryStage,
                where: necesaryStage ? {
                    watch: true
                } : null
            }
        ];
    }

    async getWatchedQuotes(page, limit) {
        return await RiteWay.Quote.findAll({
            include: this.quoteIncludeData(),
            offset: page * limit,
            limit: limit,
            paranoid: false
        });
    }

    async getCity(stateAbbrv, cityName, zip_code = '') {
        const cityN = cityName.trim().replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));;
        const stateAbb = stateAbbrv.trim();
        const state = await RiteWay.State.findOne({
            attributes: ['id'],
            where: {
                abbreviation: {
                    [sqOp.iLike]: `${stateAbb}`
                }
            }
        });

        if (state) {
            let city = await RiteWay.GisCity.findOne({
                where: {
                    state_id: state.id,
                    name: {
                        [sqOp.iLike]: cityN
                    }
                }
            });

            if (city) {
                return city;
            }
            else {
                const zipcode = await RiteWay.Zipcode.findOne({
                    attributes: ['id', 'code'],
                    where: {
                        state_id: state.id,
                        code: zip_code.trim()
                    }
                });

                if (zipcode) {

                    city = await RiteWay.GisCity.create({
                        name: cityN,
                        state_id: state.id,
                        zipcode_id: zipcode.id
                    });
                    Logger.info(`City ${cityN} (${stateAbb}, ${zipcode.code}) created`);
                    return city;
                }
                else {
                    await Stage.CityNotFound.findOrCreate({
                        defaults: {
                            name: cityN,
                            state: stateAbb,
                            zipcode: zip_code.trim(),
                            created_at: moment().format('YYYY-MM-DD hh:mm:ss')
                        },
                        where: {
                            name: cityN,
                            state: stateAbb
                        }
                    });
                    throw new Error(`There is'n a zipcode ${zip_code.trim()}(${cityN}, ${stateAbbrv})`);
                }
            }
        }

        throw new Error(`There is'n a state ${stateAbbrv}`);
    }

    async getZipcode(stateAbbrv, code) {
        const zip = code.trim();
        const stateAbb = stateAbbrv.trim();
        const state = await RiteWay.State.findOne({
            where: {
                abbreviation: {
                    [sqOp.iLike]: `${stateAbb}`
                }
            }
        });

        if (state) {
            const [zipcode, isNew] = await RiteWay.Zipcode.findOrCreate({
                where: {
                    code: zip
                },
                defaults: {
                    state_id: state.id,
                    code: zip
                }
            });

            return zipcode
        }

        throw new Error(`There is'n a state ${stateAbbrv}`);
    }

    async getUser(userData, plainPassword = '', options) {
        const password = await Crypter.encryptPassword(plainPassword);

        userData.username = userData.username.trim().toLowerCase();
        userData.password = password;

        const [user, isCreated] = await RiteWay.User.findOrCreate({
            where: {
                username: {
                    [sqOp.iLike]: userData.username
                }
            },
            defaults: userData,
            ...options
        })

        return user;
    }

    async findUser(username) {
        return await RiteWay.User.findOne({
            where: {
                username: {
                    [sqOp.iLike]: username.trim()
                }
            }
        });
    }

    async findCarrier(insuranceICCNumber, email = undefined) {
        let conditions = [];

        if(!insuranceICCNumber) return null;

        if (email) {
            conditions.push(Sequelize.where(
                Sequelize.col('email'),
                'ilike',
                `${email.trim()}`
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
                    ...conditions,
                    Sequelize.where(
                        Sequelize.col('carrierDetail.insurance_iccmcnumber'),
                        'ilike',
                        `${insuranceICCNumber.trim()}`
                    )
                ]
            },
            subQuery: false
        });
        return carrier;
    }

    async getVehicleMaker(makerName) {
        const name = makerName.trim();
        const [vMaker, isCreated] = await RiteWay.VehicleMaker.findOrCreate({
            where: {
                name: {
                    [sqOp.iLike]: name
                }
            },
            defaults: {
                name
            }
        });
        return vMaker;
    }

    async getVehicleType(typeName) {
        const name = typeName.trim();
        const [vType, isCreated] = await RiteWay.VehicleType.findOrCreate({
            where: {
                name: {
                    [sqOp.iLike]: name
                }
            },
            defaults: {
                name
            }
        });
        return vType;
    }

    async getVehicleModel(makerName, modelName) {
        const name = modelName.trim();
        const vMaker = await this.getVehicleMaker(makerName);
        if (vMaker) {
            const [vModel, isCreated] = await RiteWay.VehicleModel.findOrCreate({
                where: {
                    name: {
                        [sqOp.iLike]: name
                    },
                    maker_id: vMaker.id
                },
                defaults: {
                    name,
                    maker_id: vMaker.id
                }
            });
            return vModel;
        }
        return null;
    }

    //PARSE DATA=========================================
    async parseFDEntityToCustomerCompanyData(FDEntity) {
        let shipperUser = await this.findUser(FDEntity.shipper.email);
        let customerCompany = null;

        //Get company data
        if (shipperUser) {
            customerCompany = await RiteWay.Company.findByPk(shipperUser.company_id);
        }
        else if (FDEntity.shipper.company != null && FDEntity.shipper.company.trim() != '') {
            customerCompany = await RiteWay.Company.findOne({
                where: {
                    [sqOp.and]: [
                        Sequelize.where(
                            Sequelize.col('name'),
                            'ILIKE',
                            `${FDEntity.shipper.company.trim()}`
                        )
                    ]
                }
            });
        }
        else {
            let city = await this.getCity(FDEntity.shipper.state, FDEntity.shipper.city, FDEntity.shipper.zip.replace(/\D/g, ""));
            let zipcode = await this.getZipcode(FDEntity.shipper.state, FDEntity.shipper.zip.replace(/\D/g, ""));

            let operator = await this.findUser(FDEntity.assignedTo.email.trim());
            let defaultOperator = await this.findUser(SyncConf.defaultOperator);

            customerCompany = {
                isNew: true,
                name: FDEntity.shipper.company.trim(),
                photo: '',
                email: FDEntity.shipper.email.trim().toLowerCase(),
                phone: FDEntity.shipper.phone1,
                address: FDEntity.shipper.address1,
                operator: operator || defaultOperator,
                operator_id: operator ? operator.id : defaultOperator.id,
                city_id: city.id,
                zipcode_id: zipcode.id,
                company_type_id: COMPANY_TYPES.CUSTOMER
            };
        }

        if (shipperUser == null) {
            shipperUser = {
                isNew: true,
                name: FDEntity.shipper.fname,
                last_name: FDEntity.shipper.lname,
                username: FDEntity.shipper.email.trim().toLowerCase(),
                password: '',
                photo: '',
                phone: FDEntity.shipper.phone1,
                shipper_type: '',
                company_id: customerCompany.id || null,
                rol_id: ROLES.CUSTOMER
            };
        }
        return {
            user: shipperUser,
            company: customerCompany
        };
    }

    async parseFDEntityToNotesData(FDEntity) {
        let authors = {};
        let notesData = [];
        for (let i = 0; i < FDEntity.notes.length; i++) {
            let fdNote = FDEntity.notes[i];
            let authorUser = null;
            let authorEmail = fdNote.email.trim().toLowerCase();

            if (authors[authorEmail]) {
                authorUser = authors[authorEmail];
            }
            else {
                authorUser = await this.findUser(authorEmail);

                if (authorUser) {
                    authors[authorUser.username] = authorUser;
                }
            }

            if (authorUser) {
                let noteData = {
                    user_id: authorUser.id,
                    createdAt: fdNote.created,
                    updatedAt: fdNote.created,
                    showOnCustomerPortal: fdNote > 0,
                    text: fdNote.text
                };

                notesData.push(noteData);
            }
        }
        return notesData;
    }

    async parseFDEntityToVehicles(FDEntity) {
        let vehicles = [];

        for (let i = 0; i < FDEntity.vehicles.length; i++) {
            let vehicle = FDEntity.vehicles[i];
            let vehicleData = {
                year: vehicle.year,
                lot: vehicle.lot,
                vin: vehicle.vin,
                plate: vehicle.plate,
                state: vehicle.state,
                color: vehicle.color,
                inop: vehicle.inop,
                tariff: Number(vehicle.tariff),
                carrier_pay: Number(vehicle.carrier_pay),
                deposit: Number(vehicle.deposit),
            }

            let vehicleType = await this.getVehicleType(vehicle.type);
            let vehicleModel = await this.getVehicleModel(vehicle.make, vehicle.model);

            vehicleData.type_id = vehicleType.id;
            vehicleData.model_id = vehicleModel.id;

            vehicles.push(vehicleData);
        }
        return vehicles;
    }

    async parseFDEntityToCarrierDriverData(FDEntity) {
        let result = {
            carrier: null,
            driver: null
        };
        let defaultDispatcher = await this.findUser(SyncConf.defaultDispatcher);

        if (FDEntity.carrier) {
            result.carrier = await this.findCarrier(FDEntity.carrier.insurance_iccmcnumber, FDEntity.carrier.email);

            if (result.carrier == null) {

                let city = await this.getCity(FDEntity.carrier.state, FDEntity.carrier.city, FDEntity.carrier.zip_code.replace(/\D/g, ""));
                let zipcode = await this.getZipcode(FDEntity.carrier.state, FDEntity.carrier.zip_code.replace(/\D/g, ""));

                result.carrier = {
                    isNew: true,
                    name: FDEntity.carrier.company_name.trim(),
                    photo: '',
                    email: FDEntity.carrier.email.trim().toLowerCase(),
                    phone: FDEntity.carrier.phone1,
                    address: FDEntity.carrier.address1,
                    zip: FDEntity.carrier.zip_code.replace(/\D/g, ""),
                    city_id: city.id,
                    zipcode_id: zipcode.id,
                    created_at: FDEntity.carrier.create_date,
                    updated_at: FDEntity.carrier.create_date,
                    deleted_at: null,
                    company_type_id: COMPANY_TYPES.CARRIER
                }
            }

            result.carrier.carrierDetail = {
                insurance_iccmcnumber: FDEntity.carrier.insurance_iccmcnumber.trim(),
                dispatcher_id: defaultDispatcher.id,
            };

            if (FDEntity.carrier.driver != null) {
                let names = (FDEntity.carrier.driver.driver_name || '').trim().split(' ');
                let firstName = names[0];
                let lastName = names.length > 1 ? names.slice(1).join(' ') : '';
                let phone = FDEntity.carrier.driver.driver_phone.replace(/[^0-9]/g, "");

                let username = FDEntity.carrier.driver.driver_name.replace(/[^a-zA-Z]/g, "");
                username = `${username}_${phone}_${result.carrier.email}`.toLowerCase();

                if (firstName != '' && phone != '') {
                    result.driver = {
                        isNew: true,
                        name: firstName,
                        last_name: lastName,
                        username,
                        password: '',
                        photo: '',
                        phone: phone,
                        company_id: result.carrier.id || null,
                        rol_id: ROLES.DRIVER,
                        driverDetail: {
                            insurance_expire: FDEntity.carrier.insurance_expirationdate ? FDEntity.carrier.insurance_expirationdate.trim() : null,
                        }
                    };
                }
            }
        }

        return result;
    }

    async parseFDEntityToOriginDestinationLocations(FDEntity) {
        let result = {
            originLocation: null,
            destinationLocation: null
        };

        let locationType = function (locationType) {
            return ADDRESS_TYPE[locationType.toUpperCase()] || 1;
        };

        result.originLocation = {
            address: FDEntity.origin.address1,
            name: FDEntity.origin.company,
            address_type_id: locationType(FDEntity.origin.location_type),
            pickup_time_start: FDEntity.origin.hours,
            pickup_time_end: FDEntity.origin.hours,
            contact_information: {
                name: FDEntity.origin.name || '',
                phone: FDEntity.origin.phone1 || '',
                email: ''
            }
        };

        result.destinationLocation = {
            address: FDEntity.destination.address1,
            name: FDEntity.destination.company,
            address_type_id: locationType(FDEntity.destination.location_type),
            pickup_time_start: FDEntity.destination.hours,
            pickup_time_end: FDEntity.destination.hours,
            contact_information: {
                name: FDEntity.destination.name || '',
                phone: FDEntity.destination.phone1 || '',
                email: ''
            }
        };

        return result;
    }

    async parseFDEntityToPaymentData(FDEntity) {
        let result = {
            tariff: Number(FDEntity.tariff),
            totalPaid: 0,
            invoiceData: null,
            paymentsData: []
        };

        let lastPaymentDate = null;

        if (FDEntity.payments.length > 0) {
            for (let i = 0; i < FDEntity.payments.length; i++) {
                let fdPayment = FDEntity.payments[i];
                let amount = Number(fdPayment.amount);

                let userFullName = fdPayment.user.contactname.split(' ');
                let userData = {
                    name: userFullName[0],
                    last_name: userFullName.slice(1).join(' '),
                    username: fdPayment.user.email.trim().toLowerCase(),
                    photo: '',
                    phone: fdPayment.user.phone,
                    company_id: null,
                    rol_id: ROLES.OPERATOR
                };
                let user = await this.getUser(userData, userData.username);

                if (user) {
                    await OperatorUser.findOrCreate({
                        where: {
                            fdEmail: userData.username
                        },
                        defaults: {
                            riteWayId: user.id,
                            riteWayPass: userData.username,
                            fdEmail: fdPayment.user.email.trim().toLowerCase(),
                        }
                    });
                }

                if (fdPayment.from == 'Shipper' && fdPayment.to == "Company") {
                    result.totalPaid += amount;
                    if (lastPaymentDate == null) {
                        lastPaymentDate = fdPayment.created;
                    }

                    if (moment(fdPayment.created).isAfter(lastPaymentDate)) {
                        lastPaymentDate = fdPayment.created;
                    }
                }

                let paymentData = {
                    amount: amount,
                    transaction_id: fdPayment.transaction_id,
                    from: fdPayment.from,
                    to: fdPayment.to,
                    user_id: user.id,
                    created_at: fdPayment.created,
                    updated_at: fdPayment.created,
                };

                result.paymentsData.push(paymentData);
            }
        }

        //Invoice.................
        if (this._parseStatus(FDEntity.status) == ORDER_STATUS.DELIVERED) {
            result.invoiceData = {
                status: result.tariff > result.totalPaid ? 'pending' : 'paid',
                is_paid: !(result.tariff > result.totalPaid),
                paid_at: result.tariff > result.totalPaid ? null : lastPaymentDate,
                createdAt: FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created,
                updatedAt: FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created,
                amount: result.tariff,
                archived: false,
                invoice_url: '',
                invoice_type_id: INVOICE_TYPES.CUSTOMER
            };
        }

        return result;
    }

    async parseFDEntityToQuoteData(FDEntity, associateCompany = null) {
        let quoteData = {};

        let oriZipcode = FDEntity.origin.zip ? FDEntity.origin.zip.replace(/\D/g, "") : '';
        let originCity = await this.getCity(FDEntity.origin.state, FDEntity.origin.city, oriZipcode);
        let originZipcode = await this.getZipcode(FDEntity.origin.state, oriZipcode);

        let destZipcode = FDEntity.destination.zip ? FDEntity.destination.zip.replace(/\D/g, "") : '';
        let destinationCity = await this.getCity(FDEntity.destination.state, FDEntity.destination.city, destZipcode);
        let destinationZipcode = await this.getZipcode(FDEntity.destination.state, destZipcode);

        let { user, company } = await this.parseFDEntityToCustomerCompanyData(FDEntity);;

        quoteData.distance = FDEntity.distance;
        quoteData.quantity = FDEntity.vehicles.length;
        quoteData.estimated_ship_date = FDEntity.est_ship_date || FDEntity.avail_pickup_date;
        quoteData.ship_via = (FDEntity.ship_via - 1 > 0 ? FDEntity.ship_via - 1 : 0);
        quoteData.offered_at = FDEntity.ordered || FDEntity.created;
        quoteData.created_at = FDEntity.created;
        quoteData.updated_at = FDEntity.created;
        quoteData.deleted_at = FDEntity.archived || null;
        quoteData.fd_id = FDEntity.id;
        quoteData.fd_number = FDEntity.FDOrderID;
        quoteData.tariff = Number(FDEntity.tariff);
        quoteData.all_tariffed = FDEntity.all_tariffed;

        quoteData.origin_zip = FDEntity.origin.zip.replace(/\D/g, "") || '';
        quoteData.origin_address = FDEntity.origin.address1;
        quoteData.origin_zipcode_id = originZipcode ? originZipcode.id : null;
        quoteData.origin_city_id = originCity ? originCity.id : null;

        quoteData.destination_zip = FDEntity.destination.zip.replace(/\D/g, "") || '';
        quoteData.destination_address = FDEntity.destination.address1;
        quoteData.destination_zipcode_id = destinationZipcode ? destinationZipcode.id : null;
        quoteData.destination_city_id = destinationCity ? destinationCity.id : null;

        quoteData.vehicles = await this.parseFDEntityToVehicles(FDEntity);
        quoteData.notes = await this.parseFDEntityToNotesData(FDEntity);

        //Get company and user from FDEntity
        if (associateCompany) {
            quoteData.company = associateCompany;
            quoteData.company_id = associateCompany.id;

            quoteData.user = user;
            quoteData.user.company_id = associateCompany.id;
        }
        else {
            quoteData.company = company;
            quoteData.company_id = company.id || null;

            quoteData.user = user;
            quoteData.user.company_id = company.id || null;
        }

        //quote status................
        let fdStatus = this._parseStatus(FDEntity.status);
        if (fdStatus == QUOTE_STATUS.CANCELLED) {
            quoteData.status_id = fdStatus;
            quoteData.deletedAt = FDEntity.archived;
            quoteData.reason = FDEntity.cancel_reason;
        }
        else if (FDEntity.type < 3) {
            if (quoteData.tariff > 0) {
                quoteData.status_id = QUOTE_STATUS.OFFERED;
            }
            else {
                quoteData.status_id = QUOTE_STATUS.WAITING;
            }
        }
        else {
            quoteData.status_id = QUOTE_STATUS.ORDERED;
        }

        return quoteData;
    }

    async parseFDEntityToOrderData(FDEntity, associateCompany = null) {
        let orderData = {
            status_id: this._parseStatus(FDEntity.status),
            created_at: FDEntity.ordered || FDEntity.created,
            updated_at: FDEntity.ordered || FDEntity.created,
            estimated_delivery_date: FDEntity.delivery_date || FDEntity.delivered,
            delivered_at: FDEntity.delivered,
            picked_up_at: FDEntity.actual_pickup_date || FDEntity.avail_pickup_date,
            deleted_at: FDEntity.archived || null,
            user_accept_id: associateCompany ? associateCompany.customerDetail.operator_id : null,
        };

        let { originLocation, destinationLocation } = await this.parseFDEntityToOriginDestinationLocations(FDEntity);
        let { carrier, driver } = await this.parseFDEntityToCarrierDriverData(FDEntity);
        let { paymentsData, invoiceData, totalPaid } = await this.parseFDEntityToPaymentData(FDEntity);

        orderData.originLocation = originLocation;
        orderData.destinationLocation = destinationLocation;

        orderData.carrier = carrier;
        orderData.driver = driver;

        orderData.payments = paymentsData;

        orderData.invoice = invoiceData;
        orderData.totalPaid = totalPaid;

        return orderData;
    }
    // Main parse method
    async parseFDEntity(FDEntity, associateCompany = null) {
        let quoteData = await this.parseFDEntityToQuoteData(FDEntity, associateCompany);

        if (quoteData.status_id == QUOTE_STATUS.ORDERED) {
            quoteData.order = await this.parseFDEntityToOrderData(FDEntity, associateCompany);
        }

        return quoteData;
    }

    //Upload files
    uploadDocument(orderId, fileData) {
        return this.orderResource.uploadDocument(orderId, fileData);
    }

    uploadBOL(orderId, fileData) {
        return this.orderResource.uploadBOL(orderId, fileData);
    }

    uploadInvoice(invoiceId, fileData) {
        return this.invoiceResource.uploadInvoiceFile(invoiceId, fileData);
    }

    uploadToS3(filePath, s3Path) {
        return S3.uploadAWS(filePath, s3Path);
    }
}

module.exports = RiteWayAutotranportService;