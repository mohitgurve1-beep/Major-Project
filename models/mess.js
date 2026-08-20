const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messSchema = new Schema({
    name : {
        type : String,
        required: true,
        trim: true,
    },
    description : {
        type : String,
        trim: true,
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
    monthlyPrice : {
        type : Number,
        min : 0,
    },
    mealType : {
        type : String,
        enum : ['Veg', 'Non-Veg', 'Both'],
        default : 'Both',
    },
    breakfast : {
        type : Boolean,
        default : false,
    },
    lunch : {
        type : Boolean,
        default : false,
    },
    dinner : {
        type : Boolean,
        default : false,
    },
    timing : {
        type : String,
        trim : true,
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
    availability : {
        type : String,
        enum : ['Available', 'Closed'],
        default : 'Available',
    },
    owner : {
        type : Schema.Types.ObjectId,
        ref : "User",
    },
});

const Mess = mongoose.model("Mess", messSchema);
module.exports = Mess;
