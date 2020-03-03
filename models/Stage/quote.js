const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Quote extends Model{}

Quote.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        riteWayId: {type: Sequelize.INTEGER, allowNull: false, unique: true},
        fdOrderId: {type: Sequelize.STRING, allowNull: true},
        fdAccountId: {type: Sequelize.STRING, allowNull: true},
        fdResponse: {type: Sequelize.STRING, allowNull: true},
        status: {type: Sequelize.STRING, allowNull: false}, //error, waiting, offered, pick up, in transit, delivered
        //status: {}, //macropoint
        watch: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
    },
    {
        sequelize: ritewayDB,
        modelName: 'quotes',
        schema: 'stage',
        timestamps: true,
        underscored: true
    }
);

module.exports = Quote;
//order status
//pick up, in transit, delivered, damage
