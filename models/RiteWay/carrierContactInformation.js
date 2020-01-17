const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class CarrierContactInformation extends Model { }

CarrierContactInformation.init(
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING, allowNull: false },
        phone: { type: Sequelize.STRING, allowNull: true },
        ext: { type: Sequelize.STRING, allowNull: true },
        address: { type: Sequelize.STRING, allowNull: true },
    },
    {
        sequelize: ritewayDB,
        modelName: 'carrier_contact_information',
        timestamps: false,
        underscored: true
    }
);

module.exports = CarrierContactInformation;
