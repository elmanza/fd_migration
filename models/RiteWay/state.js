const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class State extends Model{}

State.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false},
        abbreviation: {type: Sequelize.STRING, allowNull: false}
    },
    {
        sequelize: ritewayDB,
        modelName: 'states',
        timestamps: false,
        underscored: true
    }
);

module.exports = State;