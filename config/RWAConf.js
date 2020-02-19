require('dotenv').config();
module.exports = {
    host: process.env.RITEWAY_HOST,
    credentials: {
        username: process.env.RITEWAY_USER,
        password: process.env.RITEWAY_PASS
    }
}