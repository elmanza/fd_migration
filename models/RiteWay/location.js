const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Location extends Model{}

Location.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        pickup_time_start: {type: Sequelize.STRING, allowNull: false},
        pickup_time_end: {type: Sequelize.STRING, allowNull: false},
        address: {type: Sequelize.STRING, allowNull: false},
        company_name: {type: Sequelize.STRING, allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'locations',
        timestamps: true,
        underscored: true
    }
);

module.exports = Location;