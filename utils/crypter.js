require('dotenv').config();
const bcrypt = require('bcrypt');
const crypter = { };

crypter.encryptPassword = async (plainInPassword) => {
    const hashPassword = await bcrypt.hash(plainInPassword, process.env.SALT_ROUNDS);
    return hashPassword;
};

crypter.comparePasswords = async (inUserPassword, savedUserPassword) => {
    try {
        return await bcrypt.compare(inUserPassword, savedUserPassword);
    } catch (error) {
        console.log(error);
    }
};

module.exports = crypter;
