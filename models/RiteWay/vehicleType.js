const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class VehicleType extends Model{}

VehicleType.init(
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING, allowNull: false }
    },
    {
        sequelize: ritewayDB,
        modelName: 'vehicle_type',
        timestamps: false,
        underscored: true
    }
);

module.exports = VehicleType;