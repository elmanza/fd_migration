const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Order extends Model{}

Order.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        status: {type: Sequelize.STRING, allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'orders',
        timestamps: false,
        underscored: true
    }
);

module.exports = Order;