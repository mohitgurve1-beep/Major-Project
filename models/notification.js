const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    recipient: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    actor: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    type: {
        type: String,
        enum: [
            // Student
            'visit_request_accepted',
            'visit_request_rejected',
            // Owner
            'new_visit_request',
            'visit_cancelled',
            'new_review',
            // Future compatible (reserved)
            'booking_confirmed',
            'booking_cancelled',
            'room_deleted',
            'room_reported',
        ],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        default: '',
    },
    link: {
        type: String,
        default: '',
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for fast per-user history + unread badge count (newest first)
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);

