const jwt = require('jsonwebtoken');
const JWTService = {};

JWTService.generate = function (payloadTokenData) {
    try {
        token = jwt.sign(
            payloadTokenData,
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPERIES_IN * 1000 || 600000,
                algorithm: process.env.JWT_ALGORITHM || "HS256"
            }
        );

        return token;

    } catch (error) {
        return token = null;
    }
};

JWTService.verify = function (token) {
    let token_v = jwt.verify(
        token,
        process.env.JWT_SECRET,
        {
            algorithms: [process.env.JWT_ALGORITHM]
        });
    return token_v;
}

JWTService.decode = function (token) {
    return jwt.decode(
        token,
        process.env.JWT_SECRET,
        {
            algorithms: [process.env.JWT_ALGORITHM]
        });
}

module.exports = JWTService;