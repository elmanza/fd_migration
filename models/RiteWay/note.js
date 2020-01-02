const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Note extends Model{}

Note.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        autor_name: {type: Sequelize.STRING, allowNull: false},
        autor_email: {type: Sequelize.STRING, allowNull: false},
        text: {type: Sequelize.STRING, allowNull: false},
        showOnCustomerPortal: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
        createdAt: {type: Sequelize.DATE, allowNull: true},
    },
    {
        sequelize: ritewayDB,
        modelName: 'notes',
        timestamps: true,
        underscored: true
    }
);

module.exports = Note;