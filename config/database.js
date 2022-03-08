require('dotenv').config();

const Sequelize = require('sequelize');

function getSequelizeConnection(params) {
    const sequelizeDatabaseConnection = new Sequelize(
        params.dbName,
        params.dbUsername,
        params.dbPassword,
        {
            host: params.dbHost,
            dialect: params.dbDialect,
            timezone: '-05:00', // config timezone
            pool: {
                max: params.pool.max,
                min: params.pool.min,
                acquire: 30000,
                idle: 10000
            },
            logging: false
        }
    );

    return sequelizeDatabaseConnection;
}
//Generate a instance of db connection
riteWayDBConn = getSequelizeConnection({
    dbUsername: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbHost: process.env.DB_HOST,
    dbName: process.env.DB_NAME,
    dbDialect: process.env.DB_DIALECT,
    pool: {
        max: Number(process.env.DB_MAX_CONNECTIONS || 10),
        min: Number(process.env.DB_MIN_CONNECTIONS || 2)
    }
});

module.exports = {
    ritewayDB: riteWayDBConn
};