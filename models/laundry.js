const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const laundrySchema = new Schema({
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
    washFoldPrice : {
        type : Number,
        min : 0,
    },
    ironPrice : {
        type : Number,
        min : 0,
    },
    dryCleaningPrice : {
        type : Number,
        min : 0,
    },
    pickupAvailable : {
        type : Boolean,
        default : false,
    },
    deliveryAvailable : {
        type : Boolean,
        default : false,
    },
    sameDayService : {
        type : Boolean,
        default : false,
    },
    workingHours : {
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

const Laundry = mongoose.model("Laundry", laundrySchema);
module.exports = Laundry;
