const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isAdmin } = require("../middleware");
const admin = require("../controllers/admin");
router.get("/", isLoggedIn, isAdmin, wrapAsync(admin.dashboard));
router.post("/payments/:id/settle", isLoggedIn, isAdmin, wrapAsync(admin.settlePayment));
router.post("/payout-requests/:id", isLoggedIn, isAdmin, wrapAsync(admin.processPayoutRequest));
module.exports = router;
