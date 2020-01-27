require('dotenv').config();
module.exports = {
    host: process.env.FD_LeanTech_Host,
    credentials: {
        APICode: process.env.FD_APICode,
        APIUser: process.env.FD_APIUser,
        APIPasscode: process.env.FD_APIPasscode
    }
}