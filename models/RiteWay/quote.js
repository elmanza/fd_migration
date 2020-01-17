const Sequelize = require('sequelize');
const {ritewayDB} = require('../../config/database');
const Model = Sequelize.Model;

class Quote extends Model { }
Quote.init(
    {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

        quantity: { type: Sequelize.INTEGER, allowNull: false },
        estimated_ship_date: { type: Sequelize.DATE, allowNull: false },
        ship_via: { type: Sequelize.INTEGER, defaultValue: 1, allowNull: false },

        picked_up_at: { type: 'TIMESTAMP', allowNull: true },

        origin_zip: { type: Sequelize.INTEGER, allowNull: false },
        origin_address: { type: Sequelize.STRING, allowNull: true },

        destination_zip: { type: Sequelize.INTEGER, allowNull: false },
        destination_address: { type: Sequelize.STRING, allowNull: true },

        state: { type: Sequelize.STRING, allowNull: false },
        tariff: { type: Sequelize.DOUBLE, allowNull: true },

        additional_information: { type: Sequelize.STRING, allowNull: true },
    },
    {
        sequelize: ritewayDB,
        modelName: 'quotes',
        timestamps: true,
        underscored: true,
        paranoid: true
    }
);

module.exports = Quote;