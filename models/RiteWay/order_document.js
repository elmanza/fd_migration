const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class OrderDocument extends Model{}

OrderDocument.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false},
        urlFile: {type: Sequelize.STRING, allowNull: false},
        uploadedAt: {type: 'timestamp', allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'order_documents',
        timestamps: false,
        underscored: true
    }
);

module.exports = OrderDocument;