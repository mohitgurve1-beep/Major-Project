const express = require('express');
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");
const {isLoggedIn, isOwner, validateListing, isOwnerRole, isNotOwner, isListingOwner, isVisitRequestOwner, validateVisitRequest} = require("../middleware.js");

const listingController = require("../controllers/listings.js");
const multer  = require('multer');
const {storage} = require("../cloudConfig.js");
const upload = multer({storage});


router.route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    isOwnerRole,
    upload.single("listing[image]"),
    wrapAsync(listingController.createListing),
    validateListing,
  );

//New Route
router.get("/new", isLoggedIn, isOwnerRole, listingController.renderNewForm);

// Owner Dashboard route
router.get("/owner/dashboard", isLoggedIn, isOwnerRole, wrapAsync(listingController.renderOwnerDashboard));

// Owner Visit Requests
router.get("/owner/visit-requests", isLoggedIn, isOwnerRole, wrapAsync(listingController.getOwnerVisitRequests));

router.route("/:id")
   .get(wrapAsync(listingController.showListing))
   .put(isLoggedIn, isOwnerRole, isOwner, upload.single("listing[image]"), wrapAsync(listingController.updateListing), validateListing)
   .delete(isLoggedIn, isOwnerRole, isOwner, wrapAsync(listingController.destroyListing));



//Edit Route
router.get("/:id/edit", isLoggedIn, isOwnerRole, isOwner, wrapAsync(listingController.renderEditForm));

// Visit Request Routes
router.post("/:id/visit-request", isLoggedIn, isNotOwner, validateVisitRequest, wrapAsync(listingController.sendVisitRequest));

router.post("/:id/visit-request/:requestId/cancel", isLoggedIn, isVisitRequestOwner, wrapAsync(listingController.cancelVisitRequest));

router.post("/:id/visit-request/:requestId/status", isLoggedIn, isListingOwner, wrapAsync(listingController.updateVisitRequestStatus));

module.exports = router;
