const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Vehicle extends Model { }

Vehicle.init(
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        year: { type: Sequelize.INTEGER, allowNull: false },
        lot: { type: Sequelize.STRING, allowNull: true },
        vin: { type: Sequelize.STRING, allowNull: true },
        plate: { type: Sequelize.STRING, allowNull: true },
        state: { type: Sequelize.STRING, allowNull: true },
        color: { type: Sequelize.STRING, allowNull: true },
        inop: { type: Sequelize.STRING, allowNull: true },
        tariff: { type: Sequelize.NUMBER, allowNull: true },
        gatePass: {type: Sequelize.STRING, allowNull: true},
    },
    {
        sequelize: ritewayDB,
        modelName: 'vehicles',
        timestamps: false,
        underscored: true
    }
);

module.exports = Vehicle;