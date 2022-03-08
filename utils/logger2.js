const util = require("util");

module.exports = (obj)=>{
    console.log(util.inspect(obj, false, 12, true));
}