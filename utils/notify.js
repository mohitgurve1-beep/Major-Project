const Notification = require("../models/notification");
const User = require("../models/user");

/**
 * Create a single notification for one recipient.
 * Failures are logged, never thrown (notifications must not break core flows).
 */
const notifyUser = async ({ recipient, actor, type, title, message, link }) => {
    try {
        if (!recipient) return;
        await Notification.create({
            recipient,
            actor: actor || undefined,
            type,
            title,
            message: message || '',
            link: link || '',
        });
    } catch (err) {
        console.warn("Failed to create notification:", err.message);
    }
};

/**
 * Create notifications for multiple recipients (deduplicated).
 */
const notifyUsers = async (recipients, payload) => {
    try {
        const uniqueRecipients = [...new Set(recipients.filter(Boolean).map(String))];
        if (!uniqueRecipients.length) return;

        const docs = uniqueRecipients.map((recipient) => ({
            recipient,
            actor: payload.actor || undefined,
            type: payload.type,
            title: payload.title,
            message: payload.message || '',
            link: payload.link || '',
        }));

        await Notification.insertMany(docs);
    } catch (err) {
        console.warn("Failed to create notifications:", err.message);
    }
};

/**
 * Notify every admin user.
 */
const notifyAllAdmins = async (payload) => {
    try {
        const admins = await User.find({ role: 'admin' }).select('_id');
        if (!admins.length) return;
        await notifyUsers(admins.map((a) => a._id), payload);
    } catch (err) {
        console.warn("Failed to notify admins:", err.message);
    }
};

module.exports = { notifyUser, notifyUsers, notifyAllAdmins };

