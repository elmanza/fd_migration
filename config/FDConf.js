require('dotenv').config();
module.exports = {
    host: process.env.FD_LeanTech_Host,
    apiUrl: process.env.FD_LeanTech_Host+'application/FD_APIS/APIS/',
    credentials: {
        APICode: process.env.FD_APICode,
        APIUser: process.env.FD_APIUser,
        APIPasscode: process.env.FD_APIPasscode
    }
}