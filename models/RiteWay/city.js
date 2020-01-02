const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class City extends Model{}

City.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false},
        zip: {type: Sequelize.INTEGER, allowNull: true},
        lat: {type: Sequelize.STRING, allowNull: true},
        lng: {type: Sequelize.STRING, allowNull: true},
    },
    {
        sequelize: ritewayDB,
        modelName: 'cities',
        timestamps: false,
        underscored: true
    }
);

module.exports = City;