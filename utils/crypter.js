require('dotenv').config();
const bcrypt = require('bcrypt');
const crypter = { };
const Logger = require('./logger');

crypter.encryptPassword = async (plainInPassword) => {
    const hashPassword = await bcrypt.hash(plainInPassword, process.env.SALT_ROUNDS);
    return hashPassword;
};

crypter.comparePasswords = async (inUserPassword, savedUserPassword) => {
    try {
        return await bcrypt.compare(inUserPassword, savedUserPassword);
    } catch (error) {
        Logger.error(error);
    }
};

module.exports = crypter;
