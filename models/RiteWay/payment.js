const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Payment extends Model { }

Payment.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        amount: {type: Sequelize.INTEGER, allowNull: true},
        transaction_id: {type: Sequelize.STRING, allowNull: true },
        from: {type: Sequelize.STRING, allowNull: true },
        to: {type: Sequelize.STRING, allowNull: true },
        createdAt: { type: 'TIMESTAMP', allowNull: false },
        updatedAt: { type: 'TIMESTAMP', allowNull: false },
    },
    {
        sequelize: ritewayDB,
        modelName: 'payments',
        timestamps: false,
        underscored: true
    }
);

module.exports = Payment;