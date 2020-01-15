const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Document extends Model{}

Document.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false},
        url_file: {type: Sequelize.STRING, allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'documents',
        timestamps: false,
        underscored: true
    }
);

module.exports = Document;