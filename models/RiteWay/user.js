const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class User extends Model{}

User.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false},
        last_name: {type: Sequelize.STRING, allowNull: false},
        username: {type: Sequelize.STRING, allowNull: false, unique: true},
        password: {type: Sequelize.STRING, allowNull: false},
        photo: {type: Sequelize.STRING, allowNull: true},
        phone: {type: Sequelize.STRING, allowNull: true},
        shipper_type: {type: Sequelize.STRING, allowNull: true},
        enabled: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
        isOperator:  {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
        isCompanyAdmin: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue:false},
        isSuperAdmin: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue:false},
    },
    {
        sequelize: ritewayDB,
        schema: 'public',
        modelName: 'users',
        timestamps: false,
        underscored: true
    }
);

module.exports = User;