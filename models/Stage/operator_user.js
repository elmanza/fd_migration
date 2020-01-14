const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const {User}  = require("../../models/RiteWay/_riteWay");
const Model = Sequelize.Model;

class OperatorUser extends Model{}

OperatorUser.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        riteWayId: {type: Sequelize.INTEGER, allowNull: false, unique: true},
        riteWayPass:  {type: Sequelize.STRING, allowNull: true},
        fdId: {type: Sequelize.STRING, allowNull: true, unique: true},
        fdUsername: {type: Sequelize.STRING, allowNull: true},
        fdEmail: {type: Sequelize.STRING, allowNull: true, unique: true},
        fdPassword: {type: Sequelize.STRING, allowNull: true},
        watch: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
    },
    {
        sequelize: ritewayDB,
        modelName: 'operator_users',
        schema: 'stage',
        timestamps: true,
        underscored: true
    }
);

OperatorUser.belongsTo(User, {
    foreignKey: 'rite_way_id',
    constraints: true
});

OperatorUser.sync();

module.exports = OperatorUser;
//order status
//pick up, in transit, delivered, damage
