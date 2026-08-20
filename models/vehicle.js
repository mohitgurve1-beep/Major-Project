const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const vehicleSchema = new Schema({
    name : {
        type : String,
        required : true,
        trim : true,
    },
    description : {
        type : String,
        trim : true,
    },
    image : {
        url : String,
        filename : String,
    },
    images : [
        {
            url : String,
            filename : String,
        },
    ],
    vehicleType : {
        type : String,
        enum : ['Car', 'Bike', 'Scooter'],
        default : 'Bike',
    },
    brand : {
        type : String,
        trim : true,
    },
    model : {
        type : String,
        trim : true,
    },
    dailyPrice : {
        type : Number,
        min : 0,
    },
    weeklyPrice : {
        type : Number,
        min : 0,
    },
    monthlyPrice : {
        type : Number,
        min : 0,
    },
    fuelType : {
        type : String,
        enum : ['Petrol', 'Diesel', 'Electric', 'CNG'],
        default : 'Petrol',
    },
    seats : {
        type : Number,
        min : 1,
    },
    gearType : {
        type : String,
        enum : ['Manual', 'Automatic'],
        default : 'Manual',
    },
    mileage : {
        type : String,
        trim : true,
    },
    availability : {
        type : String,
        enum : ['Available', 'Rented', 'Maintenance'],
        default : 'Available',
    },
    address : {
        type : String,
        trim : true,
    },
    city : {
        type : String,
        trim : true,
    },
    location : {
        type : String,
        trim : true,
    },
    mapLocation : {
        type : String,
        trim : true,
    },
    contactNumber : {
        type : String,
        trim : true,
    },
    owner : {
        type : Schema.Types.ObjectId,
        ref : "User",
    },
});

const Vehicle = mongoose.model("Vehicle", vehicleSchema);
module.exports = Vehicle;
