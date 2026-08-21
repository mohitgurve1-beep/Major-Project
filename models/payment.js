const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentSchema = new Schema({
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // `listing` remains for existing room payments; `service` supports all modules.
    listing: { type: Schema.Types.ObjectId, ref: "Listing" },
    serviceType: { type: String, enum: ["listing", "mess", "laundry", "vehicle"], default: "listing" },
    serviceModel: { type: String, enum: ["Listing", "Mess", "Laundry", "Vehicle"], default: "Listing" },
    service: { type: Schema.Types.ObjectId, refPath: "serviceModel" },
    parentPayment: { type: Schema.Types.ObjectId, ref: "Payment", index: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    remainingAmount: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    ownerAmount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["online", "cod", "none"], required: true },
    status: { type: String, enum: ["created", "pending_cod", "booking_pending", "partially_paid", "paid", "failed", "refunded"], default: "created", index: true },
    razorpayOrderId: { type: String, sparse: true, index: true },
    razorpayPaymentId: { type: String, sparse: true },
    razorpaySignature: String,
    paidAt: Date,
    creditedToWallet: { type: Boolean, default: false },
    walletStatus: { type: String, enum: ["pending", "available", "settled"], default: "pending" },
    settledAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
