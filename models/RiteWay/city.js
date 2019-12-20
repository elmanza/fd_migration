const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class City extends Model{}

City.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false},
        zip: {type: Sequelize.INTEGER, allowNull: false},
        lat: {type: Sequelize.STRING, allowNull: false},
        lng: {type: Sequelize.STRING, allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'cities',
        timestamps: false,
        underscored: true
    }
);

module.exports = City;