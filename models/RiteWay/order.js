const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Order extends Model{}

Order.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        status: {type: Sequelize.STRING, allowNull: false},
        estimated_delivery_date: {type: Sequelize.DATE, allowNull: true},
        isFavorite: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
        pickedUpAt: {type: Sequelize.DATE, allowNull: true},
        deliveredAt: {type: Sequelize.DATE, allowNull: true},
        shipper_information:{type: Sequelize.STRING, allowNull: true},
        macroPointId: {type: Sequelize.STRING, allowNull: true},
        macroPointActive:{type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false},
        po_number: {type: Sequelize.STRING, allowNull: true},
        bol:{type: Sequelize.STRING, allowNull: true},
        createdAt: {type: 'timestamp', allowNull: true},
        updatedAt: {type: 'timestamp', allowNull: true},
        deletedAt: {type: 'timestamp', allowNull: true}
    },
    {
        sequelize: ritewayDB,
        modelName: 'orders',
        timestamps: false,
        underscored: true
    }
);

module.exports = Order;