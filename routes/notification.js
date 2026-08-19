const express = require('express');
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");

const notificationController = require("../controllers/notifications.js");

// Notification history (logged-in users only)
router.get("/", isLoggedIn, wrapAsync(notificationController.getNotifications));

// Mark one notification as read (ownership checked in controller)
router.post("/:id/read", isLoggedIn, wrapAsync(notificationController.markAsRead));

// Mark all notifications as read
router.post("/read-all", isLoggedIn, wrapAsync(notificationController.markAllRead));

module.exports = router;

