const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class ContactInformation extends Model{}

ContactInformation.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        phone: {type: Sequelize.STRING, allowNull: false},
        email: {type: Sequelize.STRING, allowNull: false},
        name: {type: Sequelize.STRING, allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'contact_informations',
        timestamps: false,
        underscored: true
    }
);

module.exports = ContactInformation;