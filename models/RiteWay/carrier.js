const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Carrier extends Model { }

Carrier.init(
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        company_name: { type: Sequelize.STRING, allowNull: false },
        email: { type: Sequelize.STRING, allowNull: true },
        address: { type: Sequelize.STRING, allowNull: true },
        zip: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.STRING, allowNull: true },
        insurance_iccmcnumber: { type: Sequelize.STRING, allowNull: false },
    },
    {
        sequelize: ritewayDB,
        modelName: 'carriers',
        timestamps: false,
        underscored: true
    }
);

module.exports = Carrier;
