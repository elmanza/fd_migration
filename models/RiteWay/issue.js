const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Issue extends Model{}

Issue.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        description: {type: Sequelize.STRING, allowNull: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'issues',
        timestamps: true,
        underscored: true
    }
);

module.exports = Issue;