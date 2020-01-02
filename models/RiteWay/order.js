const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Order extends Model{}

Order.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        status: {type: Sequelize.STRING, allowNull: false},
        isFavorite: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'orders',
        timestamps: true,
        underscored: true
    }
);

module.exports = Order;