const QuoteResource = require("./services/FreightDragon/resources/quote");
const OrderResource = require("./services/FreightDragon/resources/order");

quote = new QuoteResource("b6c3436d272910a93c549fc5c31df29d", "9264733a5875c25eda74d6643a878b75");
order = new OrderResource("0102f76a4acf983ec7bfd484033f746f", "a89c0fa177a62936e7fbbd6043f58e67");

//=================QUOTE=========================

//se debe conocer el assignedID
quoteData = {
    //Consistencia dentro de la tabla entities=======================================
    ExternalOrderID:"EXT-TEST01",
    EntityFlag:2, // (1 = Fetch from FD entity | 2 = Fetch from External Entity | 3 = Fetch from OrderID
    AssignedID:1,
    ReferrerID: 18, //RiteWay Main WebSite 
    //Shipper Contact Information=================================
    shipping_est_date:"2019-12-24",
    ShippingShipVia:1, // 1:Open 2:Closed 3: DriveAway

    ShipperFName: "Raimundo",
    ShipperLName: "Lean Tech",
    ShipperEmail: "raimundo@lean-tech.io",
    AssignedID: 1, // (provided to you in this document)
    ShipperPhone1: "3111123123", //(please provide the number in a string)
    ShipperType: "Residential", // (Residential / Commercial)
    update_shipper: 0, 
    //Origin Posting Information ====================================
    OriginCity:"New York", //| Origin City name
    OriginState:"NY", // Origin State Name
    OriginCountry:"US",//| Origin Country Name
    OriginZip:"12345", //| Origin ZipCode

    //Destination Posting information================================
    DestinationCity:"Plantation", //| Destination City Name
    DestinationState:"FL", //| Destination State Name
    DestinationCountry:"US", //| Destination Country Name
    destination_zip:12345, //Destination ZipCode
    
    //Vehicle Information=============================================
    vehicleCount:1, //| Total Number of Vehicles (atleast one should be there)
    year0:2014,
    make0:"bajaj",
    model0:"avenger",
    type0:"Sedan", //Coupe, Sedan Small, Sedan Midsize, Sedan Large, Convertible, Pickup Small, Pickup Crew Cab, Pickup Full-size, Pickup Extd. Cab, RV, Dually, SUV Small,SUV Mid-size, SUV Large, Travel Trailer, Van Mini, Van Full-size, Van Extd. Length, Van Pop-Top, Motorcycle, Boat, Othe
    tariff0:0,
    deposit0:0,
    carrier_pay0:0,
    send_email:0, //| 0: Dont send Email 1: Send email
    save_shipper:1, //0 or 1(when new shipper is added than mandatory 0 = false 1 = true)
    update_shipper:0,// 0 or 1 (when existing is getting updated than mandatory 0=false 1=true
};

/*
Notas:
    *No guarda el ExternalOrderID
    *Por ende se debe buscar en funcion del EntityID retornado, que en realidad es el FDOrderID para actualizar una orden
*/

/*quote.create(quoteData)
.then(res => {
    console.log(res);
})
.catch(error => {
    console.log(error);
});*/

quote.get({
    FDOrderID: "6CW-713873|1XB-713872",
})
.then(res => {
    console.log("qoute->get", res);
})
.catch(error => {
    console.log("qoute->get error", error);
});
/*
quote.toOrder({
    FDOrderID: "6EC-713855",
})
.then(res => {
    console.log("qoute->get", res);
})
.catch(error => {
    console.log("qoute->get error", error);
});*/

//=================ORDER=========================
//update
/*
orderData = {
    FDOrderID: "4TI-713846",
    UpdateBy:3,
    save_shipper: 0, //0 or 1(when new shipper is added than mandatory 0 = false 1 = true)
    update_shipper:0,// 0 or 1 (when existing is getting updated than mandatory 0=false 1=true
}

order.update(orderData).then(res => {
    console.log(res);
})
.catch(error => {
    console.log(error);
});*/
//get
/*order.get({
    FDOrderID: "4TI-713846",
})
.then(res => {
    console.log("order->get", res);
})
.catch(error => {
    console.log("order->get error", error);
});*/