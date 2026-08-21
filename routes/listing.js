const express = require('express');
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");
const {isLoggedIn, validateListing, isOwnerRole, isNotOwner, isListingOwner, isVisitRequestOwner, validateVisitRequest, manageListingAccess} = require("../middleware.js");

const listingController = require("../controllers/listings.js");
const multer  = require('multer');
const {storage, MAX_FILES} = require("../cloudConfig.js");
const upload = multer({storage});


router.route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    isOwnerRole,
    upload.array("images", 10),
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
   .put(isLoggedIn, ...manageListingAccess, upload.array("images", 10), wrapAsync(listingController.updateListing), validateListing)
   .delete(isLoggedIn, ...manageListingAccess, wrapAsync(listingController.destroyListing));



//Edit Route
router.get("/:id/edit", isLoggedIn, ...manageListingAccess, wrapAsync(listingController.renderEditForm));

// Visit Request Routes
router.post("/:id/visit-request", isLoggedIn, isNotOwner, validateVisitRequest, wrapAsync(listingController.sendVisitRequest));

router.post("/:id/visit-request/:requestId/cancel", isLoggedIn, isVisitRequestOwner, wrapAsync(listingController.cancelVisitRequest));

router.post("/:id/visit-request/:requestId/status", isLoggedIn, isListingOwner, wrapAsync(listingController.updateVisitRequestStatus));

module.exports = router;
