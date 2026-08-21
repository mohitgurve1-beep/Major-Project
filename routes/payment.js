const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isStudentRole, isOwnerRole } = require("../middleware");
const payments = require("../controllers/payments");

router.get("/checkout/:listingId", isLoggedIn, isStudentRole, wrapAsync(payments.renderCheckout));
router.get("/checkout/:serviceType/:serviceId", isLoggedIn, isStudentRole, wrapAsync(payments.renderCheckout));
router.post("/create", isLoggedIn, isStudentRole, wrapAsync(payments.createPayment));
router.post("/verify", isLoggedIn, isStudentRole, wrapAsync(payments.verifyOnlinePayment));
router.post("/:id/fail", isLoggedIn, isStudentRole, wrapAsync(payments.markPaymentFailed));
router.get("/:id/remaining", isLoggedIn, isStudentRole, wrapAsync(payments.renderRemainingPayment));
router.post("/:id/remaining/create", isLoggedIn, isStudentRole, wrapAsync(payments.createRemainingPayment));
router.get("/my", isLoggedIn, isStudentRole, wrapAsync(payments.myPayments));
router.get("/owner", isLoggedIn, isOwnerRole, wrapAsync(payments.ownerPayments));
router.post("/owner/payout-details", isLoggedIn, isOwnerRole, wrapAsync(payments.savePayoutDetails));
router.post("/owner/payout-request", isLoggedIn, isOwnerRole, wrapAsync(payments.requestPayout));
router.post("/:id/confirm-cod", isLoggedIn, isOwnerRole, wrapAsync(payments.confirmCod));
module.exports = router;
