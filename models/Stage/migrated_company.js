const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const {Company}  = require("../../models/RiteWay/_riteWay");
const Model = Sequelize.Model;

class MigratedCompany extends Model{}

MigratedCompany.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        rite_way_company_id: {type: Sequelize.INTEGER, allowNull: false, unique: true},
        startedAt: {type: 'timestamp', allowNull: false},
        finishedAt: {type: 'timestamp', allowNull: true},
        migrated: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'migrated_companies',
        schema: 'stage',
        underscored: true
    }
);

MigratedCompany.sync();

module.exports = MigratedCompany;
//order status
//pick up, in transit, delivered, damage
