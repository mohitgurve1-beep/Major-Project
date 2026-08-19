const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");
const { ref, string, number } = require("joi");

const listingSchema = new Schema({
    title : {
        type : String,
        required: true,
    },
    description : {
        type : String,
    },
    image : {
        url : String,
        filename : String,        
    },
    price : Number,
    location : String,
    country : String,
    // Phase 11 — Advanced Search & Smart Filters (additive, optional, safe defaults)
    city : {
        type : String,
        trim : true,
    },
    roomType : {
        type : String,
        enum : ['Single Room', 'Shared Room', 'PG', '1RK', '1BHK', '2BHK'],
        default : 'Single Room',
    },
    furnishing : {
        type : String,
        enum : ['Fully Furnished', 'Semi Furnished', 'Unfurnished'],
    },
    genderPreference : {
        type : String,
        enum : ['Boys', 'Girls', 'Anyone'],
        default : 'Anyone',
    },
    availability : {
        type : String,
        enum : ['Available', 'Occupied', 'Reserved'],
        default : 'Available',
    },
    minimumStay : {
        type : Number,
        min : 1,
        default : 1,
    },
    amenities : {
        type : [String],
        default : [],
    },
    reviews : [
        {
            type: Schema.Types.ObjectId,
            ref : "Review",
        },
    ],
    owner : {
        type : Schema.Types.ObjectId,
        ref:"User"
    },
    geometry : {
       type: {
         type: String,
         enum: ['Point'],
         required: true,
       },
       coordinates: {
         type: [Number],
         required: true,
       }
    },
    visitRequests : [
        {
            student : {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            date : {
                type: Date,
                required: true,
            },
            time : {
                type: String,
                required: true,
            },
            message : {
                type: String,
                default: '',
            },
            status : {
                type: String,
                enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
                default: 'pending',
            },
            createdAt : {
                type: Date,
                default: Date.now,
            },
        },
    ],
});

listingSchema.post("findOneAndDelete", async (listing) => {
    if(listing){
        await Review.deleteMany({_id : {$in: listing.reviews}});
    }
});

const Listing = mongoose.model("Listing",listingSchema);
module.exports = Listing;
