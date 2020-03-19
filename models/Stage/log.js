const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Log extends Model{}

Log.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        level: {type: Sequelize.STRING},
        message: {type: 'text'},
        createdAt: {type: 'timestamp', allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'log',
        schema: 'stage',
        timestamps: false,
        underscored: true
    }
);

module.exports = Log;
