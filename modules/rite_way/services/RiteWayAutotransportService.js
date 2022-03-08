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
let customer_balance_paid_by = [
    9,
        13,
        7,
        11,
        4,
        4,
        14
];

const FEESTYPE = [ 1, 1, 2, 3, 4, 5];
// 14	customer	ACH
// 7	customer	Cash
// 4	customer	Company Check
// 11	customer	Credit Card
// 9	customer	Other
// 13	customer	Wire - Transfer


// Entity::ACH => '1 - ACH',
// 			Entity::COMPANY_CHECK => '2 - Company Check',
// 			Entity::CREDIT_CARD => '3 - Credit Card',
// 			Entity::MONEY_ORDER => '4 - Money Order',
// 			Entity::PARSONAL_CHECK => '5 - Personal Check',
// 			Entity::WIRE_TRANSFER => '6 - Wire - Transfer',


// if($entity['customer_balance_paid_by'] == Entity::WIRE_TRANSFER)
// 				  $optionStr = "Wire - Transfer";
// 				elseif($entity['customer_balance_paid_by'] == Entity::MONEY_ORDER)
// 				  $optionStr = "Money Order";
// 				elseif($entity['customer_balance_paid_by'] == Entity::CREDIT_CARD)
// 				  $optionStr = "Credit Card";
// 				elseif($entity['customer_balance_paid_by'] == Entity::PARSONAL_CHECK)
// 				  $optionStr = "Personal Check";
// 				elseif($entity['customer_balance_paid_by'] == Entity::COMPANY_CHECK)
// 				  $optionStr = "Company Check";
// 				elseif($entity['customer_balance_paid_by'] == Entity::ACH)
// 				  $optionStr = "ACH";
// 				else
// 				  $optionStr = "N/A";

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
            [FD_STATUS.PICKEDUP]: [ORDER_STATUS.INTRANSIT_DELAY, ORDER_STATUS.INTRANSIT_ONTIME],
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
                model: RiteWay.Zipcode,
                required: true,
                as: 'originZipcode',
                attributes: [ 'id', 'code' ]
            },
            {
                model: RiteWay.Zipcode,
                required: true,
                as: 'destinationZipcode',
                attributes: [ 'id', 'code' ]
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
        console.log("laksndlkansdkn  ", stateAbbrv, cityName, zip_code);
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
        console.log("lasbiiiiiii ---->>>> ", stateAbbrv, " city ", cityN, " zip_code", zip_code);

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
                    return null;
                    // throw new Error(`There is'n a zipcode ${zip_code.trim()}(${cityN}, ${stateAbbrv})`);
                }
            }
        }else{
            return null;
        //   throw new Error(`There is'n a state ${stateAbbrv}`);
        }
        
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
        let shipper__type = FDEntity.shipper.shipper_type == "" ? "Residential" : FDEntity.shipper.shipper_type;
        console.log("shipper__type-COMPANY -->", FDEntity.shipper.company);
        // console.log("r ", shipperUser.name, "||||", shipperUser.dataValues.name);
        //Get company data
        if (shipperUser) {
            customerCompany = await RiteWay.Company.findByPk(shipperUser.company_id, {paranoid: false});
            console.log("Encontramos al shipperUse --->", shipperUser.company_id)
        }else if (FDEntity.shipper.company != null && FDEntity.shipper.company.trim() != '') {
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
        }else {
            let state_info = FDEntity.shipper.state == "" ? FDEntity.origin.state : FDEntity.shipper.state;
            let city_info = FDEntity.shipper.city == "" ? FDEntity.origin.city : FDEntity.shipper.city;
            let zipcode_info = FDEntity.shipper.zip == "" ? FDEntity.origin.zip : FDEntity.shipper.zip;
            let city = zipcode_info.replace(/\D/g, "").length < 4 ? null : await this.getCity(state_info, city_info, zipcode_info.replace(/\D/g, ""));
            let zipcode = await this.getZipcode(state_info, zipcode_info.replace(/\D/g, ""));

            let operator = await this.findUser(FDEntity.assignedTo.email.trim());
            let defaultOperator = await this.findUser(SyncConf.defaultOperator);

            if(!operator){
                let userFullName = FDEntity.assignedTo.contactname.split(' ');
                let userData = {
                    name: userFullName[0],
                    last_name: userFullName.slice(1).join(' '),
                    username: FDEntity.assignedTo.email.trim().toLowerCase(),
                    photo: '',
                    phone: FDEntity.assignedTo.phone,
                    company_id: 149, // master 149 || dev 3105
                    rol_id: ROLES.OPERATOR
                };
                operator = await this.getUser(userData, userData.username);
            }  
            customerCompany = {
                id: null,
                isNew: true,
                name: `${(FDEntity.shipper.company == "") ? `Residential - Sales ${operator.name} ${operator.last_name}` : FDEntity.shipper.company}`,
                photo: '',
                email: FDEntity.shipper.email.trim().toLowerCase(),
                phone: FDEntity.shipper.phone1,
                address: FDEntity.shipper.address1,
                operator: operator || defaultOperator,
                operator_id: operator ? operator.id : defaultOperator.id,
                city_id: city.id,
                zipcode_id: zipcode.id,
                company_type_id: COMPANY_TYPES.CUSTOMER,
                shipper_type: shipper__type
            };
        }

        if(customerCompany == null){
            let state_info = FDEntity.shipper.state == "" ? FDEntity.origin.state : FDEntity.shipper.state;
            let city_info = FDEntity.shipper.city == "" ? FDEntity.origin.city : FDEntity.shipper.city;
            let zipcode_info = FDEntity.shipper.zip == "" ? FDEntity.origin.zip : FDEntity.shipper.zip;
            let city = zipcode_info.replace(/\D/g, "").length < 4 ? null : await this.getCity(state_info, city_info, zipcode_info.replace(/\D/g, ""));
            let zipcode = await this.getZipcode(state_info, zipcode_info.replace(/\D/g, ""));

          let operator = await this.findUser(FDEntity.assignedTo.email.trim());
          let defaultOperator = await this.findUser(SyncConf.defaultOperator);
          if(!operator){
            let userFullName = FDEntity.assignedTo.contactname.split(' ');
            let userData = {
                name: userFullName[0],
                last_name: userFullName.slice(1).join(' '),
                username: FDEntity.assignedTo.email.trim().toLowerCase(),
                photo: '',
                phone: FDEntity.assignedTo.phone,
                company_id: 149, // master 149 || dev 3105
                rol_id: ROLES.OPERATOR
            };
            // console.log("erData, userData.userna ", userData);
            operator = await this.getUser(userData, userData.username);
          }
            //   console.log("asdkjlbaslkdbaskjlbdkjsad", operator);
          // console.log("kajsbdlkasd",operator);
          customerCompany = {
            id: null,
            isNew: true,
            name: `${(FDEntity.shipper.company == "") ? `Residential - ${operator.name} ${operator.last_name}` : FDEntity.shipper.company}`,
            photo: '',
            email: FDEntity.shipper.email.trim().toLowerCase(),
            phone: FDEntity.shipper.phone1,
            address: FDEntity.shipper.address1,
            operator: operator || defaultOperator,
            operator_id: operator.id || defaultOperator.id,
            city_id: city.id,
            zipcode_id: zipcode.id,
            company_type_id: COMPANY_TYPES.CUSTOMER,
            shipper_type: shipper__type
          };
        }


        // let company__id = customerCompany == null ? null : customerCompany.id;
        // console.log("ashdlkashdlkahsdklh2",customerCompany);
        if (shipperUser == null) {
            shipperUser = {
                isNew: true,
                name: FDEntity.shipper.fname,
                last_name: FDEntity.shipper.lname,
                username: FDEntity.shipper.email.trim().toLowerCase(),
                password: FDEntity.shipper.email.trim().toLowerCase(),
                photo: '',
                phone: FDEntity.shipper.phone1,
                shipper_type: '',
                company_id: customerCompany.id,
                rol_id: ROLES.CUSTOMER_ADMIN
            };
        }
        let usersCustomer = [];
        // if(FDEntity.shippers){
        //     usersCustomer = FDEntity.shippers.map(element=>{
        //         return {
        //           isNew: true,
        //           name: element.fname,
        //           last_name: element.lname,
        //           username: element.email.trim().toLowerCase(),
        //           password: 'Customer2021*',
        //           photo: '',
        //           phone: FDEntity.shipper.phone1,
        //           shipper_type: '',
        //           company_id: customerCompany.id,
        //           rol_id: ROLES.CUSTOMER_ADMIN
        //         };
        //     })
        // }
        customerCompany.shipper_hours = FDEntity.shipper.shipper_hours;
        
        return {
            user: shipperUser,
            company: customerCompany,
            users: usersCustomer
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
        let vehicleSummary = [];
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
            const vehicle_type = vehicle.type.replace('\\', '');
            console.log("LLLEGO AL FINAL DE LOS VEHICLES", vehicle_type)
            let vehicleType = await this.getVehicleType(vehicle_type);
            let vehicleModel = await this.getVehicleModel(vehicle.make, vehicle.model);
            vehicleData.type_id = vehicleType.id;
            vehicleData.model_id = vehicleModel.id;

            vehicles.push(vehicleData);
            vehicleSummary.push({
                "vin": vehicle.vin, 
                "inop": vehicle.inop, 
                "type": vehicleType.name, 
                "year": vehicle.year, 
                "color": vehicle.color, 
                "maker": vehicle.make, 
                "model": vehicle.model, 
                "tariff": vehicleData.tariff, 
                "deposit": vehicleData.deposit, 
                "quantity": 1, 
                "trailers": "[]", 
                "is_heavyhaul": false, 
                "vehicle_type": {
                    id:vehicleType.id,
                    name:vehicleType.name
                }
              })
        }
        return [vehicles, vehicleSummary];
    }

    async parseFDEntityToCarrierDriverData(FDEntity) {
        let result = {
            carrier: null,
            driver: null
        };
        let defaultDispatcher = await this.findUser(SyncConf.defaultDispatcher);
        let today = moment().format('YYYY-MM-DD hh:mm:ss');
        if (FDEntity.carrier) {
            let insurance_iccmcnumber = FDEntity.carrier.insurance_iccmcnumber ? FDEntity.carrier.insurance_iccmcnumber : FDEntity.carrier.driver.carrier_insurance_iccmcnumber;
            let carrier_email = FDEntity.carrier.email ? FDEntity.carrier.email : FDEntity.carrier.driver.carrier_email;
            result.carrier = await this.findCarrier(insurance_iccmcnumber, carrier_email);
            // console.log("adnadiqwidqiwd92382", result.carrier);
            if (result.carrier == null) {
                let carrier_company_name = FDEntity.carrier.company_name ? FDEntity.carrier.company_name : FDEntity.carrier.driver.carrier_company_name;
                let city_carrier = FDEntity.carrier.city ? FDEntity.carrier.city : FDEntity.carrier.driver.carrier_city;
                let zipcode_carrier = FDEntity.carrier.zip_code ? FDEntity.carrier.zip_code : FDEntity.carrier.driver.carrier_zip;
                let state_carrier = FDEntity.carrier.state ? FDEntity.carrier.state : FDEntity.carrier.driver.carrier_state;
                let city = await this.getCity(state_carrier, city_carrier, zipcode_carrier.replace(/\D/g, ""));
                let zipcode = await this.getZipcode(state_carrier, zipcode_carrier.replace(/\D/g, ""));
                

                let carrier_phone = FDEntity.carrier.phone1 ? FDEntity.carrier.phone1 : FDEntity.carrier.driver.carrier_phone_1;
                let carrier_address = FDEntity.carrier.address1 ? FDEntity.carrier.address1 : FDEntity.carrier.driver.carrier_address;
                result.carrier = {
                    isNew: true,
                    name: carrier_company_name.trim(),
                    photo: '',
                    email: carrier_email.trim().toLowerCase(),
                    phone: carrier_phone || '',
                    address: carrier_address || '',
                    zip: zipcode_carrier.replace(/\D/g, ""),
                    city_id: city.id,
                    zipcode_id: zipcode.id,
                    created_at: FDEntity.carrier.driver.create_date  || today,
                    updated_at: FDEntity.carrier.driver.create_date || today,
                    deleted_at: null,
                    company_type_id: COMPANY_TYPES.CARRIER
                }

            }

            result.carrier.carrierDetail = {
                insurance_iccmcnumber: insurance_iccmcnumber.trim(),
                dispatcher_id: defaultDispatcher.id
                // insurance_expire: FDEntity.carrier.driver.insurance_expirationdate || null
                // hours_of_operation: FDEntity.carrier.driver.hours_of_operation
            };

            if(FDEntity.carrier.insurance_expirationdate){
                result.carrier.carrierDetail.insurance_expire = FDEntity.carrier.insurance_expirationdate == "0000-00-00 00:00:00" ? moment().format('YYYY-MM-DD hh:mm:ss') : FDEntity.carrier.insurance_expirationdate;
            }

            if(FDEntity.carrier.driver){
                if(FDEntity.carrier.driver.insurance_expirationdate){
                    result.carrier.carrierDetail.insurance_expire = FDEntity.carrier.driver.insurance_expirationdate == "0000-00-00 00:00:00" ? moment().format('YYYY-MM-DD hh:mm:ss') : FDEntity.carrier.driver.insurance_expirationdate;
                }
            }
            

            if (FDEntity.carrier.driver != null) {
                let names = (FDEntity.carrier.driver.driver_name || '').trim().split(' ');
                let firstName = names[0];
                let lastName = names.length > 1 ? names.slice(1).join(' ') : '';
                let phone = FDEntity.carrier.driver.driver_phone.replace(/[^0-9]/g, "");

                let username = FDEntity.carrier.driver.driver_name.replace(/[^a-zA-Z]/g, "");
                username = `${username}_${phone}_${carrier_email}`.toLowerCase();

                if (firstName != '' && phone != '') {
                    let insurance_expire = today;
                    if(FDEntity.carrier.driver.insurance_expirationdate){
                        if(FDEntity.carrier.driver.insurance_expirationdate == "0000-00-00 00:00:00"){
                            insurance_expire = today;
                        }else{
                            insurance_expire = FDEntity.carrier.driver.insurance_expirationdate.trim();
                        }
                    }
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
                            insurance_expire
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
            company_name: FDEntity.origin.company,
            address_type_id: locationType(FDEntity.origin.location_type),
            pickup_time_start: FDEntity.origin.hours,
            pickup_time_end: FDEntity.origin.hours,
            contact_information: {
                name: FDEntity.origin.name || '',
                phone: FDEntity.origin.phone1 || '',
                email: ''
            },
            address_detail: FDEntity.origin.address2 || '',
            operation_hours: FDEntity.origin.hours || ''
        };

        result.destinationLocation = {
            address: FDEntity.destination.address1,
            name: FDEntity.destination.company,
            company_name: FDEntity.destination.company,
            address_type_id: locationType(FDEntity.destination.location_type),
            pickup_time_start: FDEntity.destination.hours,
            pickup_time_end: FDEntity.destination.hours,
            contact_information: {
                name: FDEntity.destination.name || '',
                phone: FDEntity.destination.phone1 || '',
                email: ''
            },
            address_detail: FDEntity.destination.address2 || '',
            operation_hours: FDEntity.destination.hours || ''
        };

        return result;
    }

    async parseFDEntityToPaymentData(FDEntity, isCOD = false) {
        let result = {
            tariff: Number(FDEntity.total_tariff_stored),
            totalPaid: 0,
            totalPaidCarrier: 0,
            invoiceData: null,
            paymentsData: [],
            paymentcards:[],
            payments_check:[],
            invoiceCarrierData: null
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

                if (fdPayment.from == 'Company' && fdPayment.to == "Carrier") result.totalPaidCarrier += amount;

                let paymentData = {
                    amount: amount,
                    transaction_id: fdPayment.transaction_id,
                    from: fdPayment.from,
                    to: fdPayment.to,
                    user_id: user.id,
                    created_at: fdPayment.created,
                    updated_at: fdPayment.created,
                    age: fdPayment.age,
                    payment_date: fdPayment.date_received || null
                };

                result.paymentsData.push(paymentData);
            }
        }

        // Credit cards payments
        if (FDEntity.app_paymentcards.length > 0) {
            FDEntity.app_paymentcards.forEach(cc => {
                if(cc.cc_cvv2 !== "" && cc.cc_number !== "" && cc.cc_month !== "" && cc.cc_address !== "" && cc.cc_year !== "" &&  cc.cc_fname !== ""){
                    result.paymentcards.push({
                        cvv: `${cc.cc_cvv2}`,
                        card_number: Number(cc.cc_number),
                        expiration_date: `${cc.cc_month}/${cc.cc_year}`,
                        billing_address: `${cc.cc_address}`,
                        card_name: `${cc.cc_fname} ${cc.cc_lname}`
                    })
                }
            });                    
            // console.log(FDEntity.payments," |||||||||  ",result.paymentcards);
        }

        // Checks payments
        if (FDEntity.app_payments_check.length > 0) {
            result.payments_check = FDEntity.app_payments_check.map(check =>{
                return { 
                    batch_id: Number(check.check_number) || -1,
                    created_at: `${check.delivery_date}`
                }
            })
            console.log("1928918237981273091720397123", result.payments_check);
        }

        //Invoice CUSTOMER.................
        let status_fd = this._parseStatus(FDEntity.status);
        if (status_fd == ORDER_STATUS.DELIVERED) {
            console.log("ENTRAMOS A invoiceData")
            let difference = FDEntity.total_tariff_stored == "" || FDEntity.total_tariff_stored == null ? 0 :  result.tariff - result.totalPaid;
            let is_paid = false;
            if(isCOD){
                // Proceso para COD
                // ceil(SUM(payments.amount)) = (ceil(invoices.amount) - SUM(vehicles.carrier_pay))
                if(result.totalPaid >= (Number(FDEntity.total_tariff_stored) - Number(FDEntity.carrier_pay_stored))) is_paid = true;
            }else{
                is_paid = difference <= 5 ? true : false;
            }
            result.invoiceData = {
                status: Number(result.tariff) > result.totalPaid ? 'pending' : 'paid',
                //is_paid: !(result.tariff > result.totalPaid),
                is_paid,
                paid_at: result.tariff > result.totalPaid ? null : lastPaymentDate,
                createdAt: FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created,
                updatedAt: FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created,
                amount: result.tariff,
                archived: false,
                invoice_url: FDEntity.invoice_file ? FDEntity.invoice_file : '',
                invoice_type_id: INVOICE_TYPES.CUSTOMER
            };
        }

        // carrier_invoice
        if (FDEntity.carrier_invoice.length > 0) {
            
            result.invoiceCarrierData = FDEntity.carrier_invoice.map(carrier_invoice =>{
                
                return {
                    amount: Number(carrier_invoice.Amount),
                    invoice_url: `https://freightdragon.com/uploads/Invoices/${carrier_invoice.Invoice}`,
                    is_paid: carrier_invoice.Paid ==  "1" ? true : false,
                    paid_at: carrier_invoice.PaidDate,
                    archived: carrier_invoice.Hold ==  "1" ? true : false,
                    invoice_type_id: INVOICE_TYPES.CARRIER,
                    createdAt: carrier_invoice.CreatedAt || FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created,
                    updatedAt: carrier_invoice.CreatedAt || FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created,
                    fd_invoice_carrier: true
                    // updatedAt: FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created
                }
            })
        }else{
            if(status_fd == ORDER_STATUS.DELIVERED){
                console.log("ENTRAMOS A carrier_invoice")
                let is_paid = false;
                let difference =  FDEntity.carrier_pay_stored == "" || FDEntity.carrier_pay_stored == null ? 0 : Number(FDEntity.carrier_pay_stored) - result.totalPaidCarrier;
                if(isCOD){
                    if(result.totalPaid >= (Number(FDEntity.total_tariff_stored) - Number(FDEntity.carrier_pay_stored))) is_paid = true;
                }else{
                    is_paid = difference <= 5 ? true : false;
                }
                result.invoiceCarrierData = [{
                    amount:Number(FDEntity.carrier_pay_stored),
                    invoice_url: '',
                    is_paid,
                    paid_at: null,
                    archived: false,
                    invoice_type_id: INVOICE_TYPES.CARRIER,
                    createdAt: FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created,
                    updatedAt: FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created,
                    fd_invoice_carrier: false
                    // updatedAt: FDEntity.delivered || FDEntity.actual_pickup_date || FDEntity.avail_pickup_date || FDEntity.created
                }];
            }
        }

        return result;
    }

    async parseFDEntityToQuoteData(FDEntity, associateCompany = null) {
        let quoteData = {};
        console.log("----------------------------------> FDOrderID : "+FDEntity.prefix+"-"+FDEntity.number+", est_ship_date : "+FDEntity.est_ship_date+", actual_pickup_date : "+FDEntity.actual_pickup_date+", load_date : "+FDEntity.load_date+", delivery_date : "+FDEntity.delivery_date+", delivered : "+FDEntity.delivered+", created : "+FDEntity.created+", ordered : "+FDEntity.ordered+", avail_pickup_date : "+FDEntity.avail_pickup_date+", dispatched : "+FDEntity.dispatched);
        let oriZipcode = FDEntity.origin.zip ? FDEntity.origin.zip.replace(/\D/g, "") : '';
        
        // console.log("parseFDEntityToQuoteData 22222222222", FDEntity.origin);
        let originCity = await this.getCity(FDEntity.origin.state, FDEntity.origin.city, oriZipcode);
        let originZipcode = await this.getZipcode(FDEntity.origin.state, oriZipcode);

        let destZipcode = FDEntity.destination.zip ? FDEntity.destination.zip.replace(/\D/g, "") : '';
        let destinationCity = await this.getCity(FDEntity.destination.state, FDEntity.destination.city, destZipcode);
        let destinationZipcode = await this.getZipcode(FDEntity.destination.state, destZipcode);
        // console.log("PREEE parseFDEntityToCustomerCompanyData");
        let { user, company, users } = await this.parseFDEntityToCustomerCompanyData(FDEntity);;
        console.log("POST parseFDEntityToCustomerCompanyData");
        quoteData.distance = Math.round(FDEntity.distance);
        quoteData.quantity = FDEntity.vehicles.length;
        quoteData.estimated_ship_date = `${FDEntity.avail_pickup_date || FDEntity.est_ship_date} 12:00:00`;
        quoteData.ship_via = (FDEntity.ship_via - 1 > 0 ? FDEntity.ship_via - 1 : 0);
        quoteData.offered_at = FDEntity.ordered || FDEntity.created;
        quoteData.created_at = FDEntity.created;
        quoteData.updated_at = FDEntity.created;
        quoteData.deleted_at = FDEntity.deleted == "0" ? null : FDEntity.archived || null;
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

        [quoteData.vehicles, quoteData.vehicles_summary] = await this.parseFDEntityToVehicles(FDEntity);
        quoteData.notes = await this.parseFDEntityToNotesData(FDEntity); // DESCOMENTAR EN MASTER

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
        quoteData.users = users;

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
        let estimated_picked_up = null;
        if(FDEntity.delivery_date){
            estimated_picked_up = `${FDEntity.delivery_date} 12:00:00`;
        }else{
            if(FDEntity.avail_pickup_date){
                estimated_picked_up = `${FDEntity.avail_pickup_date} 12:00:00`;
            }
        }
        let isCOD = false;
        let picked_up_at =  FDEntity.load_date ? `${FDEntity.load_date} 12:00:00` :  FDEntity.load_date;
        let payment_receive_id = null;
        if(FDEntity.balance_paid_by == 2 || FDEntity.balance_paid_by == 3 || FDEntity.balance_paid_by == 8 || FDEntity.balance_paid_by == 9){ // COD
          payment_receive_id = 15;
          isCOD = true;
        }else if(FDEntity.balance_paid_by == 12 || FDEntity.balance_paid_by == 13 || FDEntity.balance_paid_by == 15 || FDEntity.balance_paid_by == 20 || FDEntity.balance_paid_by == 21 || FDEntity.balance_paid_by == 23){ // Billing - Check
          payment_receive_id = 2;
        }else if(FDEntity.balance_paid_by == 24){ // ACH
            payment_receive_id = 1;
        }else{
            payment_receive_id = !isNaN(FDEntity.balance_paid_by) ? 1 : null;
        }

        // if(FDEntity.balance_paid_by == 13 || FDEntity.balance_paid_by == 20){
        //     payment_receive_id = 2;
        //   }else if(FDEntity.balance_paid_by == 12){
        //     payment_receive_id = 15;
        //   }else if(FDEntity.balance_paid_by == 24){
        //       payment_receive_id = 1;
        //   }else{
        //       payment_receive_id = !isNaN(FDEntity.balance_paid_by) ? 1 : null;
        //   }

        let payment_method_id = null;
        if(FDEntity.customer_balance_paid_by){
            let customer_balance_paid_by_num = Number(FDEntity.customer_balance_paid_by);
          if(customer_balance_paid_by_num < 7){
            payment_method_id = customer_balance_paid_by[customer_balance_paid_by_num];
          }else{
            payment_method_id = 9;
          }
        }

        let existSource = true;
        if(FDEntity.referred_by == null || FDEntity.referred_by == ""){
            existSource= false;
        }
        let sourceOrder = null;
        let isNewSource = null;
        if(existSource){
            [sourceOrder, isNewSource] = await RiteWay.Source.findOrCreate({
                defaults: {
                    name: `${FDEntity.referred_by}`,
                    description: `${FDEntity.referred_id}`
                },
                where: {
                    name: {
                        [sqOp.iLike]: `${FDEntity.referred_by}`
                    }
                }
            });
        }
        

        let status_id = this._parseStatus(FDEntity.status);
        let payment_option_id = FDEntity.carrier_invoice.length > 0 ? FEESTYPE[FDEntity.carrier_invoice[0].FeesType] : 
        FDEntity.balance_paid_by == 24 ? (FDEntity.delivery_credit == null || FDEntity.delivery_credit == "") ? 3 : FEESTYPE[FDEntity.delivery_credit] : 1;
        let orderData = {
            status_id,
            created_at: FDEntity.ordered,
            updated_at: FDEntity.ordered,
            estimated_delivery_date: FDEntity.delivery_date,
            picked_up_at: picked_up_at,
            delivered_at: FDEntity.delivered,
            estimated_picked_up: estimated_picked_up,
            deleted_at: FDEntity.archived || null,
            user_accept_id: associateCompany ? associateCompany.customerDetail.operator_id : null,
            dispatched_at: FDEntity.dispatched,
            payment_receive_id,
            payment_method_id,
            payment_option_id,
            bol_url: FDEntity.carrier_invoice.length > 0 ? `https://freightdragon.com/uploads/Invoices/${FDEntity.carrier_invoice[0].Invoice}` : status_id == 11 ?  isCOD ? "PaymentwithCOD" : "pendingpayments" : "WithoutBOL",
            source_id: existSource ? sourceOrder.id : -1,
            bol_uploaded_on: FDEntity.carrier_invoice.length > 0 ? FDEntity.carrier_invoice[0].CreatedAt : isCOD ? FDEntity.delivered || picked_up_at : null,
            special_instruction_dispatch_sheet: FDEntity.files.length > 0 ? FDEntity.files[0].instructions : null
        };
        // console.log("--------------------------------------", FDEntity.carrier_invoice[0]);

        // console.log(orderData);

        
        
        let { originLocation, destinationLocation } = await this.parseFDEntityToOriginDestinationLocations(FDEntity);
        let { carrier, driver } = await this.parseFDEntityToCarrierDriverData(FDEntity);        
        let { paymentsData, invoiceData, totalPaid, paymentcards, payments_check, invoiceCarrierData } = await this.parseFDEntityToPaymentData(FDEntity, isCOD);

        orderData.originLocation = originLocation;
        orderData.destinationLocation = destinationLocation;

        orderData.carrier = carrier;
        orderData.driver = driver;

        orderData.payments = paymentsData;

        orderData.paymentCards = paymentcards;
        orderData.paymentsChecks = payments_check;

        orderData.invoice = invoiceData;
        orderData.totalPaid = totalPaid;

        orderData.invoiceCarrierData = invoiceCarrierData;

        orderData.files = FDEntity.files;

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