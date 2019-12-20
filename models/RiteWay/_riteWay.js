const Quote = require('./quote');
const Order = require('./order');
const User = require('./user');
const Company = require('./company');
const State = require('./state');

const Vehicle = require('./vehicle');
const VehicleMaker = require('./vehicleMaker');
const VehicleType = require('./vehicleType');
const VehicleModel = require('./vehicleModel');

const City = require('./city');

Quote.hasMany(Order);

Order.belongsTo(Quote);

Quote.belongsTo(User, {
    foreignKey: 'user_create_id'
});

Quote.belongsTo(City, {
    foreignKey: 'origin_city',
    as: 'originCity'
}); //adds origin_city attribute to document

Quote.belongsTo(City, {
    foreignKey: 'destination_city',
    as: 'destinationCity'
}); //adds orderId attribute to document


User.hasMany(Quote, {
    foreignKey: 'user_create_id'
});
User.belongsTo(Company);
Company.hasMany(User);

City.belongsTo(State, {
    foreignKey: 'state_id',
    constraints: true
}); //adds orderId attribute to document
//_______________________________
Quote.hasMany(Vehicle);

Vehicle.belongsTo(Quote, {
    foreignKey: 'quote_id',
    constraints: true
});

Vehicle.belongsTo(VehicleModel, {
    foreignKey: 'model_id',
    constraints: true
});

VehicleModel.belongsTo(VehicleMaker, {
    foreignKey: 'maker_id',
    constraints: true
});

Vehicle.belongsTo(VehicleType, {
    foreignKey: 'type_id',
    constraints: true
});


module.exports = {
    Quote,
    Order,
    Company,
    User,
    City,
    State,
    Vehicle,
    VehicleModel,
    VehicleType,
    VehicleMaker
}