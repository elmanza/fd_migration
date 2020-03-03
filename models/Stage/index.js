const FdCompanies = require('./fd_companies');
const MigratedCompany = require('./migrated_company');
const Quote = require('./quote');
const OperatorUser = require('./operator_user');

const {Company, User, Quote:RWQuote}  = require("../../models/RiteWay/_riteWay");

FdCompanies.belongsTo(Company, {
    foreignKey: 'company_id',
    constraints: true
});

Company.hasOne(FdCompanies, {
    foreignKey: {
        name: 'company_id',
        allowNull: false
    },
    as: 'fd_companies',
    constraints: false,
});

MigratedCompany.belongsTo(FdCompanies, {
    foreignKey: 'fd_company_id',
    constraints: true
});

FdCompanies.hasOne(MigratedCompany, {
    foreignKey: 'fd_company_id',
    constraints: true
});

OperatorUser.belongsTo(User, {
    foreignKey: 'rite_way_id',
    constraints: true
});

//====================
RWQuote.hasOne(Quote, {
    foreignKey: 'rite_way_id',
    as: 'stage_quote',
    constraints: true
});

Quote.belongsTo(RWQuote, {
    foreignKey: {
        name: 'rite_way_id',
        allowNull: false
    },
    constraints: false,
});

OperatorUser.sync();
FdCompanies.sync();
MigratedCompany.sync();
Quote.sync();

module.exports = {
    Quote,
    FdCompanies,
    MigratedCompany,
    OperatorUser
}