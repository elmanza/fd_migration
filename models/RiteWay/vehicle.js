const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Vehicle extends Model{}

Vehicle.init(
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        year: { type: Sequelize.INTEGER, allowNull: false },
        lot: { type: Sequelize.STRING, allowNull: false },
        vin: { type: Sequelize.STRING, allowNull: false },
        plate: { type: Sequelize.STRING, allowNull: false },
        state: { type: Sequelize.STRING, allowNull: false },
        color: { type: Sequelize.STRING, allowNull: false },
        inop: { type: Sequelize.STRING, allowNull: false },
    },
    {
        sequelize: ritewayDB,
        modelName: 'vehicles',
        timestamps: false,
        underscored: true
    }
);

module.exports = Vehicle;