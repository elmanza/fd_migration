/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
  const FdCompanies = sequelize.define('FdCompanies', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: {
          tableName: 'companies',
          schema: 'public',
        },
        key: 'id'
      }
    }
  }, {
    tableName: 'fd_companies',
    schema: 'stage',
    timestamps: false,
    underscored: true
  });

  FdCompanies.associate = (Models, RWModels) => {
    const { MigratedCompany } = Models;
    const { Company } = RWModels;

    Company.hasMany(FdCompanies, {
      foreignKey: 'company_id',
      constraints: true
    });

    FdCompanies.belongsTo(Company, {
      foreignKey: 'company_id',
      constraints: true
    });

    FdCompanies.hasOne(MigratedCompany, {
      foreignKey: 'fd_company_id',
      constraints: true
    });
  };

  return FdCompanies;
};
