/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    const Log = sequelize.define('Log', {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      level: {
        type: DataTypes.STRING,
        allowNull: false
      },
      message: {
        type: DataTypes.STRING,
        allowNull: false
      },
      createdAt: {
        type: 'timestamp',
        allowNull: false
      },
    }, {
      tableName: 'logs',
      schema: 'stage',
      timestamps: false,
      underscored: true
    });
  
    Log.associate = (Models) => {
        
    };
  
    return Log;
  };
  