/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    const CityNotFound = sequelize.define('CityNotFound', {
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
      state: {
        type: DataTypes.STRING,
        allowNull: false
      },
      zipcode: {
        type: DataTypes.STRING,
        allowNull: false
      },
      created_at: {
        type: 'timestamp',
        allowNull: true,
      },
    }, {
      tableName: 'cities_not_found',
      schema: 'stage',
      timestamps: false,
      underscored: true
    });
  
    CityNotFound.associate = (Models) => {
        
    };
  
    return CityNotFound;
  };
  