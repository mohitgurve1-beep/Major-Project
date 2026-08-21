const crypto = require("crypto");
const Payment = require("../models/payment");
const Listing = require("../models/listing");
const Mess = require("../models/mess");
const Laundry = require("../models/laundry");
const Vehicle = require("../models/vehicle");
const User = require("../models/user");
const PayoutRequest = require("../models/payoutRequest");
const { notifyUser } = require("../utils/notify");

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 5);
const SERVICES = {
    listing: { Model: Listing, modelName: "Listing", price: item => item.price, label: "First month rent" },
    mess: { Model: Mess, modelName: "Mess", price: item => item.monthlyPrice, label: "First month mess plan" },
    laundry: { Model: Laundry, modelName: "Laundry", price: item => item.washFoldPrice, label: "Wash & fold service" },
    vehicle: { Model: Vehicle, modelName: "Vehicle", price: item => item.dailyPrice, label: "One-day vehicle rental" },
};
const getAmounts = (amount) => {
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT) / 100;
    return { platformFee, ownerAmount: Math.round((amount - platformFee) * 100) / 100 };
};
const getBookingAmount = (service, fullAmount, paymentChoice = 'full') => {
    if (service.bookingPayment === 'none') return 0;
    if (service.bookingPayment === 'advance' || (service.bookingPayment === 'flexible' && paymentChoice === 'advance')) return Math.min(Math.max(Number(service.minimumAdvance) || 0, 0), fullAmount);
    return fullAmount;
};

const creditOwnerWallet = async (payment) => {
    if (payment.creditedToWallet) return;
    await User.findByIdAndUpdate(payment.owner, { $inc: { "wallet.available": payment.ownerAmount, "wallet.lifetimeEarnings": payment.ownerAmount } });
    payment.creditedToWallet = true;
    payment.walletStatus = "available";
    await payment.save();
};
const completeParentBalance = async (payment) => {
    if (!payment.parentPayment) return;
    await Payment.findByIdAndUpdate(payment.parentPayment, { $set: { remainingAmount: 0, status: 'paid' } });
};

module.exports.renderCheckout = async (req, res) => {
    const serviceType = req.params.serviceType || "listing";
    const config = SERVICES[serviceType];
    const serviceId = req.params.serviceId || req.params.listingId;
    if (!config) return res.redirect("/listings");
    const service = await config.Model.findById(serviceId).populate("owner");
    if (!service) return res.redirect("/listings");
    if (service.owner._id.equals(req.user._id)) {
        req.flash("error", "You cannot make a payment for your own service.");
        return res.redirect(req.get("Referrer") || "/listings");
    }
    const fullAmount = Number(config.price(service));
    if (!Number.isFinite(fullAmount) || fullAmount <= 0) { req.flash("error", "This service has no valid price."); return res.redirect(req.get("Referrer") || "/listings"); }
    const amount = getBookingAmount(service, fullAmount);
    const serviceLabel = service.bookingPayment === 'advance' ? `Minimum advance (total ₹${fullAmount.toLocaleString('en-IN')})` : service.bookingPayment === 'flexible' ? 'Choose advance or full payment' : service.bookingPayment === 'none' ? 'No advance required' : config.label;
    res.render("payments/checkout.ejs", { service, serviceType, serviceLabel, amount, fullAmount, advanceAmount: getBookingAmount({ ...service.toObject(), bookingPayment: 'advance' }, fullAmount), bookingPayment: service.bookingPayment || 'full', razorpayKey: process.env.RAZORPAY_KEY_ID || "" });
};

module.exports.createPayment = async (req, res) => {
    const { serviceId, listingId, method, paymentChoice } = req.body;
    const serviceType = req.body.serviceType || "listing";
    const config = SERVICES[serviceType];
    if (!['online', 'cod', 'none'].includes(method)) return res.status(400).json({ error: "Choose a valid payment method." });
    if (!config) return res.status(400).json({ error: "Choose a valid service." });
    const service = await config.Model.findById(serviceId || listingId);
    if (!service) return res.status(404).json({ error: "Service not found." });
    if (service.owner.equals(req.user._id)) return res.status(403).json({ error: "You cannot pay for your own service." });
    const fullAmount = Number(config.price(service));
    if (!Number.isFinite(fullAmount) || fullAmount <= 0) return res.status(400).json({ error: "This service has no valid price." });
    const amount = getBookingAmount(service, fullAmount, paymentChoice);
    if ((service.bookingPayment === 'none' && method !== 'none') || (service.bookingPayment !== 'none' && method === 'none')) return res.status(400).json({ error: "This payment method is not available for this service." });
    if ((service.bookingPayment === 'advance' || (service.bookingPayment === 'flexible' && paymentChoice === 'advance')) && method !== 'online') return res.status(400).json({ error: "Minimum advances must be paid online for secure confirmation." });
    const amounts = getAmounts(amount);
    const payment = await Payment.create({
        student: req.user._id, owner: service.owner, listing: serviceType === "listing" ? service._id : undefined,
        serviceType, serviceModel: config.modelName, service: service._id,
        description: `${amount < fullAmount ? 'Advance payment' : config.label} — ${service.title || service.name}`, amount, totalAmount: fullAmount, remainingAmount: Math.max(fullAmount - amount, 0), ...amounts, method,
        status: method === "cod" ? "pending_cod" : method === "none" ? "booking_pending" : "created",
    });

    if (method === 'none') {
        await notifyUser({ recipient: service.owner, actor: req.user._id, type: "payment", title: "Booking request received", message: `${req.user.username} requested to book ${service.title || service.name}; no advance is required.`, link: "/payments/owner" });
        return res.json({ ok: true, redirect: "/payments/my" });
    }

    if (method === "cod") {
        await notifyUser({ recipient: service.owner, actor: req.user._id, type: "payment", title: "COD payment requested", message: `${req.user.username} will pay ₹${amount.toLocaleString('en-IN')} for ${service.title || service.name}. Confirm when received.`, link: "/payments/owner" });
        return res.json({ ok: true, redirect: "/payments/my" });
    }

    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) {
        await Payment.findByIdAndDelete(payment._id);
        return res.status(503).json({ error: "Online payments are not configured yet. Please choose Cash on Delivery." });
    }
    const rpResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
        body: JSON.stringify({ amount: Math.round(amount * 100), currency: "INR", receipt: payment._id.toString(), notes: { paymentId: payment._id.toString(), serviceId: service._id.toString(), serviceType } }),
    });
    const order = await rpResponse.json();
    if (!rpResponse.ok) {
        payment.status = "failed";
        await payment.save();
        return res.status(502).json({ error: order?.error?.description || "Could not start Razorpay checkout." });
    }
    payment.razorpayOrderId = order.id;
    await payment.save();
    res.json({ ok: true, order, key, paymentId: payment._id, student: { name: req.user.username, email: req.user.email, contact: req.user.phone || "" } });
};

module.exports.verifyOnlinePayment = async (req, res) => {
    const { paymentId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const payment = await Payment.findById(paymentId);
    if (!payment || !payment.student.equals(req.user._id) || payment.method !== "online") return res.status(404).json({ error: "Payment not found." });
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(razorpay_signature || "");
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer) || payment.razorpayOrderId !== razorpay_order_id) {
        payment.status = "failed";
        await payment.save();
        return res.status(400).json({ error: "Payment verification failed." });
    }
    payment.status = payment.remainingAmount > 0 ? "partially_paid" : "paid";
    payment.razorpayPaymentId = razorpay_payment_id; payment.razorpaySignature = razorpay_signature; payment.paidAt = new Date();
    await payment.save();
    await creditOwnerWallet(payment);
    await completeParentBalance(payment);
    const remainingText = payment.remainingAmount > 0 ? ` Remaining ₹${payment.remainingAmount.toLocaleString('en-IN')} is pending.` : '';
    await notifyUser({ recipient: payment.owner, actor: req.user._id, type: "payment", title: "Online payment received", message: `₹${payment.amount.toLocaleString('en-IN')} is paid and ₹${payment.ownerAmount.toLocaleString('en-IN')} is now in your wallet.${remainingText}`, link: "/payments/owner" });
    res.json({ ok: true, redirect: "/payments/my" });
};

// Called from Razorpay Checkout's payment.failed event. The student can then
// clearly see the failure in their payment history instead of a vague "created" record.
module.exports.markPaymentFailed = async (req, res) => {
    const payment = await Payment.findOne({ _id: req.params.id, student: req.user._id, method: "online" });
    if (!payment) return res.status(404).json({ error: "Payment not found." });
    if (payment.status === "paid") return res.status(409).json({ error: "A completed payment cannot be marked failed." });
    payment.status = "failed";
    await payment.save();
    res.json({ ok: true });
};

module.exports.renderRemainingPayment = async (req, res) => {
    const payment = await Payment.findOne({ _id: req.params.id, student: req.user._id, status: 'partially_paid', remainingAmount: { $gt: 0 } }).populate('service listing');
    if (!payment) { req.flash('error', 'No pending balance was found for this payment.'); return res.redirect('/payments/my'); }
    res.render('payments/remaining.ejs', { payment, razorpayKey: process.env.RAZORPAY_KEY_ID || '' });
};

module.exports.createRemainingPayment = async (req, res) => {
    const parent = await Payment.findOne({ _id: req.params.id, student: req.user._id, status: 'partially_paid', remainingAmount: { $gt: 0 } });
    const { method } = req.body;
    if (!parent || !['online', 'cod'].includes(method)) return res.status(400).json({ error: 'This balance payment is not available.' });
    const active = await Payment.exists({ parentPayment: parent._id, status: { $in: ['created', 'pending_cod'] } });
    if (active) return res.status(409).json({ error: 'A balance payment is already in progress.' });
    const amount = parent.remainingAmount;
    const amounts = getAmounts(amount);
    const payment = await Payment.create({ student: parent.student, owner: parent.owner, listing: parent.listing, serviceType: parent.serviceType, serviceModel: parent.serviceModel, service: parent.service, parentPayment: parent._id, description: `Remaining balance — ${parent.description}`, amount, totalAmount: amount, remainingAmount: 0, ...amounts, method, status: method === 'cod' ? 'pending_cod' : 'created' });
    if (method === 'cod') {
        await notifyUser({ recipient: parent.owner, actor: req.user._id, type: 'payment', title: 'Balance COD payment requested', message: `A remaining cash payment of ₹${amount.toLocaleString('en-IN')} is awaiting your confirmation.`, link: '/payments/owner' });
        return res.json({ ok: true, redirect: '/payments/my' });
    }
    const key = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) { payment.status = 'failed'; await payment.save(); return res.status(503).json({ error: 'Online payments are not configured yet.' }); }
    const rpResponse = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }, body: JSON.stringify({ amount: Math.round(amount * 100), currency: 'INR', receipt: payment._id.toString(), notes: { paymentId: payment._id.toString(), parentPaymentId: parent._id.toString() } }) });
    const order = await rpResponse.json();
    if (!rpResponse.ok) { payment.status = 'failed'; await payment.save(); return res.status(502).json({ error: order?.error?.description || 'Could not start Razorpay checkout.' }); }
    payment.razorpayOrderId = order.id; await payment.save();
    res.json({ ok: true, order, key, paymentId: payment._id, student: { name: req.user.username, email: req.user.email, contact: req.user.phone || '' } });
};

module.exports.myPayments = async (req, res) => {
    const payments = await Payment.find({ student: req.user._id }).populate("listing service").sort({ createdAt: -1 });
    res.render("payments/myPayments.ejs", { payments });
};

module.exports.ownerPayments = async (req, res) => {
    const [payments, owner, payoutRequests] = await Promise.all([Payment.find({ owner: req.user._id }).populate("student listing service").sort({ createdAt: -1 }), User.findById(req.user._id), PayoutRequest.find({ owner: req.user._id }).sort({ createdAt: -1 })]);
    res.render("payments/ownerWallet.ejs", { payments, wallet: owner.wallet || {}, payoutDetails: owner.payoutDetails || {}, payoutRequests });
};

module.exports.savePayoutDetails = async (req, res) => {
    const details = req.body.payoutDetails || {};
    const method = details.method;
    if (!['upi', 'bank'].includes(method) || (method === 'upi' && !details.upiId) || (method === 'bank' && (!details.accountHolder || !details.bankName || !details.accountNumber || !details.ifsc))) {
        req.flash("error", "Enter complete UPI or bank payout details."); return res.redirect("/payments/owner");
    }
    await User.findByIdAndUpdate(req.user._id, { $set: { payoutDetails: { method, accountHolder: details.accountHolder || '', upiId: details.upiId || '', bankName: details.bankName || '', accountNumber: details.accountNumber || '', ifsc: details.ifsc || '' } } });
    req.flash("success", "Payout details saved."); res.redirect("/payments/owner");
};

module.exports.requestPayout = async (req, res) => {
    const amount = Number(req.body.amount);
    const owner = await User.findById(req.user._id);
    const details = owner.payoutDetails || {};
    const validDetails = details.method === 'upi' ? details.upiId : (details.accountHolder && details.bankName && details.accountNumber && details.ifsc);
    if (!validDetails) { req.flash("error", "Save payout details before requesting a withdrawal."); return res.redirect("/payments/owner"); }
    if (!Number.isFinite(amount) || amount < 1 || amount > (owner.wallet?.available || 0)) { req.flash("error", "Enter an amount within your available wallet balance."); return res.redirect("/payments/owner"); }
    await PayoutRequest.create({ owner: owner._id, amount, payoutDetails: details });
    await User.findByIdAndUpdate(owner._id, { $inc: { "wallet.available": -amount, "wallet.pendingPayout": amount } });
    req.flash("success", "Payout request sent to the admin for review."); res.redirect("/payments/owner");
};

// Pending payments shown on owner dashboards / wallet: cash on delivery,
// no-advance booking requests, and online bookings with a cash balance due.
const PENDING_STATUSES = ["pending_cod", "booking_pending"];

module.exports.getPendingOwnerPayments = async (ownerId) => {
    // A parent whose balance payment is already in progress must not appear
    // alongside its active child payment (it would show the same money twice).
    const busyParents = await Payment.find({ parentPayment: { $ne: null }, status: { $in: ["created", ...PENDING_STATUSES] } }).distinct("parentPayment");
    return Payment.find({
        owner: ownerId,
        _id: { $nin: busyParents },
        $or: [
            { status: { $in: PENDING_STATUSES } },
            { status: "partially_paid", remainingAmount: { $gt: 0 } },
        ],
    }).populate("student listing service").sort({ createdAt: -1 });
};

// Owner accepts a pending payment (COD cash, no-advance booking, or the
// remaining cash balance of a partially paid booking) from their dashboard.
module.exports.confirmCod = async (req, res) => {
    const returnTo = req.body.returnTo && typeof req.body.returnTo === "string" && req.body.returnTo.startsWith("/") ? req.body.returnTo : "/payments/owner";
    const payment = await Payment.findOne({ _id: req.params.id, owner: req.user._id });
    const canAccept = payment && (PENDING_STATUSES.includes(payment.status) || (payment.status === "partially_paid" && payment.remainingAmount > 0));
    if (!canAccept) {
        req.flash("error", "This payment cannot be confirmed."); return res.redirect(returnTo);
    }
    const previousStatus = payment.status;
    if (previousStatus === "partially_paid") {
        const activeChild = await Payment.exists({ parentPayment: payment._id, status: { $in: ["created", ...PENDING_STATUSES] } });
        if (activeChild) {
            req.flash("error", "The student already has a balance payment in progress."); return res.redirect(returnTo);
        }
    }
    // Cash is collected directly by the owner. It is a confirmed cash
    // collection, not a platform-held balance, so it must never be credited
    // to the wallet. Online advances were already credited when they happened.
    payment.status = "paid";
    payment.remainingAmount = 0;
    payment.paidAt = new Date();
    payment.walletStatus = "settled";
    payment.creditedToWallet = false;
    await payment.save();
    await completeParentBalance(payment);
    const titles = {
        pending_cod: "COD payment confirmed",
        booking_pending: "Booking accepted",
        partially_paid: "Balance payment received",
    };
    await notifyUser({ recipient: payment.student, actor: req.user._id, type: "payment", title: titles[previousStatus], message: `Your payment for "${payment.description}" has been confirmed by the owner.`, link: "/payments/my" });
    req.flash("success", "Payment accepted. No wallet credit was added because cash was collected directly."); res.redirect(returnTo);
};
