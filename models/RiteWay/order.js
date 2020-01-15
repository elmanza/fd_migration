const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Order extends Model{}

Order.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        status: {type: Sequelize.STRING, allowNull: false},
        estimated_delivery_date: {type: Sequelize.DATE, allowNull: false},
        isFavorite: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
        pickedUpAt: {type: Sequelize.DATE, allowNull: true},
        deliveredAt: {type: Sequelize.DATE, allowNull: true},
        gatePass: {type: Sequelize.STRING, allowNull: true},
    },
    {
        sequelize: ritewayDB,
        modelName: 'orders',
        timestamps: true,
        underscored: true,
        paranoid: true
    }
);

module.exports = Order;