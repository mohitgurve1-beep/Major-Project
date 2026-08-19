const Notification = require("../models/notification");

// Notification history — only the logged-in user's own notifications, newest first.
module.exports.getNotifications = async (req, res) => {
    const notifications = await Notification.find({ recipient: req.user._id })
        .populate("actor", "username")
        .sort({ createdAt: -1 })
        .limit(100);

    res.render("notifications/index.ejs", { notifications });
};

// Mark a single notification as read (ownership enforced: recipient must match).
module.exports.markAsRead = async (req, res) => {
    const { id } = req.params;

    await Notification.findOneAndUpdate(
        { _id: id, recipient: req.user._id },
        { isRead: true }
    );

    res.redirect("/notifications");
};

// Mark all of the logged-in user's notifications as read.
module.exports.markAllRead = async (req, res) => {
    await Notification.updateMany(
        { recipient: req.user._id, isRead: false },
        { isRead: true }
    );

    res.redirect("/notifications");
};

