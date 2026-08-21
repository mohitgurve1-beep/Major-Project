const mongoose = require("mongoose");
const { Schema } = mongoose;

const payoutRequestSchema = new Schema({
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    payoutDetails: {
        method: { type: String, enum: ["upi", "bank"], required: true },
        accountHolder: String, upiId: String, bankName: String, accountNumber: String, ifsc: String,
    },
    status: { type: String, enum: ["pending", "processing", "paid", "rejected"], default: "pending", index: true },
    adminNote: { type: String, default: "", trim: true },
    processedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("PayoutRequest", payoutRequestSchema);
