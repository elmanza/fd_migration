const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Driver extends Model { }

Driver.init(
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING, allowNull: false },
        phone: { type: Sequelize.STRING, allowNull: false },
    },
    {
        sequelize: ritewayDB,
        modelName: 'drivers',
        timestamps: false,
        underscored: true
    }
);

module.exports = Driver;
