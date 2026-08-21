const User = require("../models/user");
const Listing = require("../models/listing");
const Mess = require("../models/mess");
const Laundry = require("../models/laundry");
const Vehicle = require("../models/vehicle");
const Payment = require("../models/payment");
const PayoutRequest = require("../models/payoutRequest");
const Review = require("../models/review");
const Notification = require("../models/notification");
const { cloudinary } = require("../cloudConfig.js");
const { notifyUser } = require("../utils/notify");

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Delete a service document together with its Cloudinary images.
const destroyServiceImages = async (item) => {
    const images = Array.isArray(item.images) && item.images.length ? item.images : (item.image ? [item.image] : []);
    for (const img of images) {
        if (img && img.filename) {
            try { await cloudinary.uploader.destroy(img.filename); } catch (e) { console.warn("Cloudinary cleanup failed:", e.message); }
        }
    }
};

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

// =====================
// User Management (students / owners)
// =====================

const SERVICE_MODELS = [["listing", Listing], ["mess", Mess], ["laundry", Laundry], ["vehicle", Vehicle]];

module.exports.renderUsers = async (req, res) => {
    const { role, q } = req.query;
    const filter = {};
    if (["student", "owner", "admin"].includes(role)) filter.role = role;
    if (q && q.trim()) {
        const rx = new RegExp(escapeRegExp(q.trim()), "i");
        filter.$or = [{ username: rx }, { email: rx }];
    }
    const [users, roleCounts] = await Promise.all([
        User.find(filter).sort({ createdAt: -1 }),
        Promise.all([User.countDocuments({ role: "owner" }), User.countDocuments({ role: "student" }), User.countDocuments({ blocked: true })]).then(([owners, students, blocked]) => ({ owners, students, blocked })),
    ]);
    // Service counts per owner via one grouped query per module (not per user).
    const serviceCounts = {};
    await Promise.all(SERVICE_MODELS.map(async ([name, Model]) => {
        const rows = await Model.aggregate([{ $group: { _id: "$owner", count: { $sum: 1 } } }]);
        rows.forEach(row => { const key = row._id?.toString(); if (!key) return; serviceCounts[key] = serviceCounts[key] || {}; serviceCounts[key][name] = row.count; });
    }));
    res.render("admin/users.ejs", { users, roleCounts, serviceCounts, filters: { role: role || "", q: q || "" } });
};

module.exports.toggleBlockUser = async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) { req.flash("error", "User not found."); return res.redirect("/admin/users"); }
    if (user.role === "admin") { req.flash("error", "Admin accounts cannot be blocked."); return res.redirect("/admin/users"); }
    user.blocked = !user.blocked;
    user.blockedAt = user.blocked ? new Date() : null;
    if (user.blocked) user.blockReason = (req.body.reason || "").slice(0, 300); else user.blockReason = "";
    await user.save();
    if (user.blocked) {
        // Notify first; the user's session ends on their next request.
        try {
            await notifyUser({ recipient: user._id, actor: req.user._id, type: "account_blocked", title: "Account blocked", message: `Your account was blocked by the admin.${user.blockReason ? ` Reason: ${user.blockReason}` : ""}`, link: "/" });
        } catch (_) {}
        req.flash("success", `${user.username} is now blocked and will be logged out.`);
    } else {
        try {
            await notifyUser({ recipient: user._id, actor: req.user._id, type: "account_unblocked", title: "Account unblocked", message: "Your account has been unblocked. Welcome back!", link: "/login" });
        } catch (_) {}
        req.flash("success", `${user.username} has been unblocked and can log in again.`);
    }
    res.redirect("/admin/users");
};

module.exports.deleteUser = async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) { req.flash("error", "User not found."); return res.redirect("/admin/users"); }
    if (user.role === "admin") { req.flash("error", "Admin accounts cannot be deleted from here."); return res.redirect("/admin/users"); }

    let summary;
    if (user.role === "owner") {
        // Delete every service the owner has listed, including their images.
        const counts = {};
        for (const [name, Model] of SERVICE_MODELS) {
            const items = await Model.find({ owner: user._id });
            for (const item of items) await destroyServiceImages(item);
            const result = await Model.deleteMany({ owner: user._id });
            counts[name] = result.deletedCount || items.length;
        }
        const payoutRequests = await PayoutRequest.deleteMany({ owner: user._id });
        summary = `Owner "${user.username}" deleted. Removed ${counts.listing} room(s), ${counts.mess} mess(es), ${counts.laundry} laundry service(s), ${counts.vehicle} vehicle(s), ${payoutRequests.deletedCount} payout request(s). Payment records were kept.`;
    } else {
        // Student cleanup: reviews (docs + references) and visit requests.
        const reviews = await Review.find({ author: user._id }).select("_id");
        const reviewIds = reviews.map(r => r._id);
        if (reviewIds.length) {
            await Listing.updateMany({ reviews: { $in: reviewIds } }, { $pull: { reviews: { $in: reviewIds } } });
            await Review.deleteMany({ _id: { $in: reviewIds } });
        }
        const visits = await Listing.updateMany({}, { $pull: { visitRequests: { student: user._id } } });
        summary = `Student "${user.username}" deleted. Removed ${reviewIds.length} review(s) and their visit requests (${visits.modifiedCount} listing(s) cleaned). Payment records were kept.`;
    }

    // Payments are kept as financial records; populate() renders them with '-'.
    await Notification.deleteMany({ $or: [{ recipient: user._id }, { actor: user._id }] });
    await User.findByIdAndDelete(user._id);
    req.flash("success", summary);
    res.redirect("/admin/users");
};

// =====================
// Service Management (moderate every owner's listings)
// =====================

const SERVICE_CONFIG = {
    listing: { Model: Listing, label: "Room", path: "listings", nameField: "title", priceField: "price", availabilities: ["Available", "Occupied", "Reserved"] },
    mess: { Model: Mess, label: "Mess", path: "messes", nameField: "name", priceField: "monthlyPrice", availabilities: ["Available", "Closed"] },
    laundry: { Model: Laundry, label: "Laundry", path: "laundry", nameField: "name", priceField: "washFoldPrice", availabilities: ["Available", "Closed"] },
    vehicle: { Model: Vehicle, label: "Vehicle", path: "vehicles", nameField: "name", priceField: "dailyPrice", availabilities: ["Available", "Rented", "Maintenance"] },
};

module.exports.renderServices = async (req, res) => {
    const { type, q } = req.query;
    const groups = await Promise.all(Object.entries(SERVICE_CONFIG).map(async ([key, config]) => {
        if (type && type !== key) return [];
        const items = await config.Model.find({}).populate("owner", "username email");
        return items.map(item => ({ item, key, config }));
    }));
    let services = groups.flat();
    if (q && q.trim()) {
        const needle = q.trim().toLowerCase();
        services = services.filter(({ item, config }) =>
            (item[config.nameField] || "").toLowerCase().includes(needle) ||
            (item.owner?.username || "").toLowerCase().includes(needle));
    }
    services.sort((a, b) => new Date(b.item.createdAt || b.item._id.getTimestamp()) - new Date(a.item.createdAt || a.item._id.getTimestamp()));
    res.render("admin/services.ejs", {
        services,
        filters: { type: type || "", q: q || "" },
        typeLabels: Object.fromEntries(Object.entries(SERVICE_CONFIG).map(([k, c]) => [k, c.label])),
        availabilities: Object.fromEntries(Object.entries(SERVICE_CONFIG).map(([k, c]) => [k, c.availabilities])),
    });
};

module.exports.setServiceAvailability = async (req, res) => {
    const { type, id } = req.params;
    const config = SERVICE_CONFIG[type];
    const value = req.body.availability;
    if (!config || !config.availabilities.includes(value)) {
        req.flash("error", "Invalid service or availability value."); return res.redirect("/admin/services");
    }
    const service = await config.Model.findByIdAndUpdate(id, { availability: value });
    if (!service) { req.flash("error", "Service not found."); return res.redirect("/admin/services"); }
    req.flash("success", `${config.label} "${service[config.nameField]}" set to ${value}.`);
    res.redirect("/admin/services");
};

module.exports.deleteService = async (req, res) => {
    const { type, id } = req.params;
    const config = SERVICE_CONFIG[type];
    if (!config) { req.flash("error", "Invalid service type."); return res.redirect("/admin/services"); }
    // findOneAndDelete triggers the Listing middleware that cleans up reviews.
    const service = await config.Model.findOneAndDelete({ _id: id });
    if (!service) { req.flash("error", "Service not found."); return res.redirect("/admin/services"); }
    await destroyServiceImages(service);
    req.flash("success", `${config.label} "${service[config.nameField]}" was deleted.`);
    res.redirect("/admin/services");
};
