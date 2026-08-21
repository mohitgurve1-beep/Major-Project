const express = require('express');
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isLaundryOwnerRole, validateLaundry, manageLaundryAccess } = require("../middleware.js");

const laundryController = require("../controllers/laundry.js");
const multer  = require('multer');
const {storage} = require("../cloudConfig.js");
const upload = multer({storage});

router.route("/")
  .get(wrapAsync(laundryController.index))
  .post(
    isLoggedIn,
    isLaundryOwnerRole,
    upload.array("images", 10),
    validateLaundry,
    wrapAsync(laundryController.createLaundry),
  );

// New Route
router.get("/new", isLoggedIn, isLaundryOwnerRole, laundryController.renderNewForm);

// Owner Laundry Dashboard
router.get("/owner/dashboard", isLoggedIn, isLaundryOwnerRole, wrapAsync(laundryController.renderOwnerLaundryDashboard));

router.route("/:id")
   .get(wrapAsync(laundryController.showLaundry))
   .put(
     isLoggedIn,
     ...manageLaundryAccess,
      upload.array("images", 10),
      validateLaundry,
      wrapAsync(laundryController.updateLaundry),
   )
   .delete(isLoggedIn, ...manageLaundryAccess, wrapAsync(laundryController.destroyLaundry));

// Edit Route
router.get("/:id/edit", isLoggedIn, ...manageLaundryAccess, wrapAsync(laundryController.renderEditForm));

module.exports = router;
