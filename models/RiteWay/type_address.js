const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class TypeAddress extends Model{}

TypeAddress.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'type_addresses',
        timestamps: false,
        underscored: true
    }
);

module.exports = TypeAddress;