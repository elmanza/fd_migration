const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Invoice extends Model { }

Invoice.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        status: {type: Sequelize.STRING, allowNull: false},
        amount: {type: Sequelize.DOUBLE, allowNull: false},
        url_invoice: {type: Sequelize.STRING, allowNull: false, defaultValue: ''},
        isPaid: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
        paided_at: {type: Sequelize.DATE, allowNull: true },
        archived:{type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
        createdAt: {type: 'timestamp', allowNull: true},
        updatedAt: {type: 'timestamp', allowNull: true},
    },
    {
        sequelize: ritewayDB,
        modelName: 'invoices',
        timestamps: false,
        underscored: true
    }
);

module.exports = Invoice;