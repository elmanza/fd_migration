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
        fd_id: { type: Sequelize.INTEGER, allowNull: true },
        fd_number: { type: Sequelize.STRING, allowNull: true },
        picked_up_at: { type: 'TIMESTAMP', allowNull: true },
        offered_at: { type: Sequelize.DATE, allowNull: true },
        origin_zip: { type: Sequelize.INTEGER, allowNull: true },
        origin_address: { type: Sequelize.STRING, allowNull: true },

        destination_zip: { type: Sequelize.INTEGER, allowNull: true },
        destination_address: { type: Sequelize.STRING, allowNull: true },

        state: { type: Sequelize.STRING, allowNull: false },
        tariff: { type: Sequelize.DOUBLE, allowNull: true },
        special_instruction: { type: Sequelize.STRING, allowNull: true },
        additional_information: { type: Sequelize.STRING, allowNull: true },
        reason: { type: Sequelize.STRING, allowNull: true },

        full_truck: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
        vehicles_full_truck: { type: Sequelize.INTEGER, allowNull: true },

        created_at: { type: 'TIMESTAMP', allowNull: true },
        updated_at: { type: 'TIMESTAMP', allowNull: true },

        fd_id: { type: Sequelize.INTEGER, allowNull: true },
        fd_number: { type: Sequelize.STRING, allowNull: true },
    },
    {
        sequelize: ritewayDB,
        modelName: 'quotes',
        timestamps: false,
        underscored: true,
        paranoid: true
    }
);

module.exports = Quote;