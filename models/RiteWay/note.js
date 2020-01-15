const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Note extends Model{}

Note.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        text: {type: Sequelize.STRING, allowNull: false},
        showOnCustomerPortal: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
        createdAt: {type: 'timestamp', allowNull: false},
        updatedAt: {type: Sequelize.DATE, allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'notes',
        timestamps: false,
        underscored: true
    }
);

module.exports = Note;