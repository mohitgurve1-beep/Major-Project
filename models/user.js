const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
    email : {
        type: String,
        required : true
    },
    role : {
        type : String,
        enum : ['student', 'owner', 'admin'],
        default : 'student',
    },
    phone : {
        type : String,
        default : '',
    },
    whatsapp : {
        type : String,
        default : '',
    },
    wallet: {
        available: { type: Number, default: 0 },
        lifetimeEarnings: { type: Number, default: 0 },
        withdrawn: { type: Number, default: 0 },
        pendingPayout: { type: Number, default: 0 },
    },
    payoutDetails: {
        method: { type: String, enum: ['upi', 'bank'], default: 'upi' },
        accountHolder: { type: String, default: '', trim: true },
        upiId: { type: String, default: '', trim: true, lowercase: true },
        bankName: { type: String, default: '', trim: true },
        accountNumber: { type: String, default: '', trim: true },
        ifsc: { type: String, default: '', trim: true, uppercase: true },
    }
});
userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model('User', userSchema);
