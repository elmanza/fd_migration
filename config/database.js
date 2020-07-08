require('dotenv').config();

const Sequelize = require('sequelize');

function getSequelizeConnection(params){
    const sequelizeDatabaseConnection = new Sequelize(
        params.dbName,
        params.dbUsername,
        params.dbPassword,
        {
            host: params.dbHost,
            dialect: params.dbDialect,
            pool: {
                max: 250,
                min: 100,
                acquire: 300000,
                idle: 300000
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
});

module.exports = {
    ritewayDB: riteWayDBConn
};