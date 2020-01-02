const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class VehicleModel extends Model{}

VehicleModel.init(
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING, allowNull: false }
    },
    {
        sequelize: ritewayDB,
        modelName: 'vehicle_model',
        timestamps: false,
        underscored: true
    }
);

module.exports = VehicleModel;