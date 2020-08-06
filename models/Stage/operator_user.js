/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    const OperatorUser = sequelize.define('OperatorUser', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        riteWayId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        riteWayPass: {
            type: DataTypes.STRING,
            allowNull: true
        },
        fdId: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        fdUsername: {
            type: DataTypes.STRING,
            allowNull: true
        },
        fdEmail: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        fdPassword: {
            type: DataTypes.STRING,
            allowNull: true
        },
        watch: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
    }, {
        tableName: 'operator_users',
        schema: 'stage',
        timestamps: true,
        underscored: true
    });

    OperatorUser.associate = (Models, RWModels) => {
        const { User } = RWModels
        OperatorUser.belongsTo(User, {
            foreignKey: 'rite_way_id',
            constraints: true
        });
    };

    return OperatorUser;
};