let print = require("./utils/logger2");

// let arr = [901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901, 901]

// const masRepetido = ar => ar.reduce((acum, el, i, ar) => {
//     const count=ar.filter(e => e==el).length;
//     return count > acum[1] ? [el, count] : acum;
// }, ["", 0]
// )
//     console.log("-----------------")
// console.log(masRepetido(arr));
  // print(JSON.stringify(res));



  let arr = [ [ '12', 18 ], [ '14', 18 ], [ '16', 18 ], [ '17', 17 ] ];
let estado = 23;
  let filtrado = arr.filter(obj => obj[0] == estado);


  let print_address1 = "PO Box 687";
 
  console.log(print_address1.substr(0,2).toUpperCase());