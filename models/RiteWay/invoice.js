const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Invoice extends Model { }

Invoice.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        status: {type: Sequelize.STRING, allowNull: false},
        amount: {type: Sequelize.INTEGER, allowNull: false},
        url_invoice: {type: Sequelize.STRING, allowNull: false, defaultValue: ''},
        is_paid: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
        paided_at: {type: Sequelize.DATE, allowNull: true },
        archived:{type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'invoices',
        timestamps: true,
        underscored: true
    }
);

module.exports = Invoice;