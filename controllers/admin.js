const User = require("../models/user");
const Listing = require("../models/listing");
const Mess = require("../models/mess");
const Laundry = require("../models/laundry");
const Vehicle = require("../models/vehicle");
const Payment = require("../models/payment");
const PayoutRequest = require("../models/payoutRequest");

module.exports.dashboard = async (req, res) => {
    const [users, rooms, messes, laundries, vehicles, payments, recentPayments, payoutRequests] = await Promise.all([
        User.countDocuments(), Listing.countDocuments(), Mess.countDocuments(), Laundry.countDocuments(), Vehicle.countDocuments(),
        Payment.find({ status: "paid" }),
        Payment.find().populate("student owner listing").sort({ createdAt: -1 }).limit(12),
        PayoutRequest.find().populate("owner").sort({ createdAt: -1 }).limit(20),
    ]);
    const revenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const profit = payments.reduce((sum, payment) => sum + payment.platformFee, 0);
    const ownerPayouts = payments.reduce((sum, payment) => sum + payment.ownerAmount, 0);
    const pendingCod = await Payment.countDocuments({ status: "pending_cod" });
    const pendingPayout = await Payment.countDocuments({ status: "paid", walletStatus: "available" });
    const pendingPayoutRequests = payoutRequests.filter(request => request.status === "pending").length;
    res.render("admin/dashboard.ejs", { stats: { users, rooms, messes, laundries, vehicles, revenue, profit, ownerPayouts, pendingCod, pendingPayout, pendingPayoutRequests, paidCount: payments.length }, recentPayments, payoutRequests });
};

module.exports.processPayoutRequest = async (req, res) => {
    const request = await PayoutRequest.findById(req.params.id);
    const status = req.body.status;
    if (!request || request.status !== "pending" || !["paid", "rejected"].includes(status)) { req.flash("error", "This payout request cannot be processed."); return res.redirect("/admin"); }
    request.status = status; request.adminNote = (req.body.adminNote || "").slice(0, 500); request.processedAt = new Date(); await request.save();
    const walletChange = status === "paid" ? { "wallet.pendingPayout": -request.amount, "wallet.withdrawn": request.amount } : { "wallet.pendingPayout": -request.amount, "wallet.available": request.amount };
    await User.findByIdAndUpdate(request.owner, { $inc: walletChange });
    req.flash("success", status === "paid" ? "Payout marked paid." : "Payout rejected and funds restored to the owner wallet."); res.redirect("/admin");
};

module.exports.settlePayment = async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment || payment.status !== "paid" || payment.walletStatus !== "available") {
        req.flash("error", "This wallet entry is not available for settlement."); return res.redirect("/admin");
    }
    payment.walletStatus = "settled"; payment.settledAt = new Date(); await payment.save();
    await User.findByIdAndUpdate(payment.owner, { $inc: { "wallet.available": -payment.ownerAmount, "wallet.withdrawn": payment.ownerAmount } });
    req.flash("success", "Owner payout marked as settled."); res.redirect("/admin");
};
