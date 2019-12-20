const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class User extends Model{}

User.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false},
        last_name: {type: Sequelize.STRING, allowNull: false},
        username: {type: Sequelize.STRING, allowNull: false},
        password: {type: Sequelize.STRING, allowNull: false},
        photo: {type: Sequelize.STRING, allowNull: false},
        enabled: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
        isOperator:  {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
        isCompanyAdmin: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue:false},
        isSuperAdmin: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue:false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'users',
        timestamps: false,
        underscored: true
    }
);

module.exports = User;