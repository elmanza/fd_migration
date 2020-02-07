const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const {Company}  = require("../../models/RiteWay/_riteWay");
const Model = Sequelize.Model;

class MigratedCompany extends Model{}

MigratedCompany.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        riteWayCompanyId: {type: Sequelize.INTEGER, allowNull: false, unique: true},
        migrated: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
    },
    {
        sequelize: ritewayDB,
        modelName: 'migrated_companies',
        schema: 'stage',
        timestamps: true,
        underscored: true
    }
);

MigratedCompany.belongsTo(Company, {
    foreignKey: 'rite_way_company_id',
    constraints: true
});

MigratedCompany.sync();

module.exports = MigratedCompany;
//order status
//pick up, in transit, delivered, damage
