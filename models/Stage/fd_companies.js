const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const {Company}  = require("../../models/RiteWay/_riteWay");
const Model = Sequelize.Model;

class FdCompanies extends Model{}

FdCompanies.init(
    {
        id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: Sequelize.STRING, allowNull: false,},
    },
    {
        sequelize: ritewayDB,
        modelName: 'fd_companies',
        schema: 'stage',
        timestamps: true,
        underscored: true
    }
);

FdCompanies.belongsTo(Company, {
    foreignKey: 'company_id',
    constraints: true
});
FdCompanies.sync();

module.exports = FdCompanies;
//order status
//pick up, in transit, delivered, damage
