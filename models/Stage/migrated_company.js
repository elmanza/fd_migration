/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    const MigratedCompany = sequelize.define('MigratedCompany', {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        fd_company_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'fd_companies',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false
        },
        ok: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        fail: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        exists: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        startedAt: {
            type: 'timestamp',
            allowNull: false
        },
        finishedAt: {
            type: 'timestamp',
            allowNull: true
        },
        migrated: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
    }, {
        tableName: 'migrated_companies',
        schema: 'stage',
        underscored: true
    });

    MigratedCompany.associate = (Models, RWModels) => {
        const { FdCompanies } = Models;

        MigratedCompany.belongsTo(FdCompanies, {
            foreignKey: 'fd_company_id',
            constraints: true
        });
    };

    return MigratedCompany;
};
