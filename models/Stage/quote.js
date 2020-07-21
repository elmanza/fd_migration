/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    const StageQuote = sequelize.define('StageQuote', {
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
                model: 'quotes',
                key: 'id'
            }
        },
        fdOrderId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        fdAccountId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        fdResponse: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false
        }, //error, waiting, offered, pick up, in transit, delivered
        watch: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
    }, {
        tableName: 'quotes',
        schema: 'stage',
        timestamps: true,
        underscored: true
    });

    StageQuote.associate = (Models, RWModels) => {
        const { Quote:RWQuote } = RWModels;

        RWQuote.hasOne(StageQuote, {
            foreignKey: 'rite_way_id',
            as: 'stage_quote',
            constraints: true
        });

        StageQuote.belongsTo(RWQuote, {
            foreignKey: {
                name: 'rite_way_id',
                allowNull: false
            },
            constraints: false,
        });
    };

    return StageQuote;
};
