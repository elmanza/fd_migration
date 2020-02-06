const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Company extends Model{}

Company.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false},
        photo: {type: Sequelize.STRING, allowNull: true},
        email: {type: Sequelize.STRING, allowNull: false, isEmail: true, unique: true},
        phone: {type: Sequelize.STRING, allowNull: false},
        show_carriers: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
        address: {type: Sequelize.STRING, allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'companies',
        timestamps: false,
        underscored: true
    }
);

module.exports = Company;