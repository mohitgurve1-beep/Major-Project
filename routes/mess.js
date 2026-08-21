const express = require('express');
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isMessOwnerRole, validateMess, manageMessAccess } = require("../middleware.js");

const messController = require("../controllers/mess.js");
const multer  = require('multer');
const {storage} = require("../cloudConfig.js");
const upload = multer({storage});

router.route("/")
  .get(wrapAsync(messController.index))
  .post(
    isLoggedIn,
    isMessOwnerRole,
    upload.array("images", 10),
    validateMess,
    wrapAsync(messController.createMess),
  );

// New Route
router.get("/new", isLoggedIn, isMessOwnerRole, messController.renderNewForm);

// Owner Mess Dashboard
router.get("/owner/dashboard", isLoggedIn, isMessOwnerRole, wrapAsync(messController.renderOwnerMessDashboard));

router.route("/:id")
   .get(wrapAsync(messController.showMess))
   .put(
     isLoggedIn,
     ...manageMessAccess,
      upload.array("images", 10),
      validateMess,
      wrapAsync(messController.updateMess),
   )
   .delete(isLoggedIn, ...manageMessAccess, wrapAsync(messController.destroyMess));

// Edit Route
router.get("/:id/edit", isLoggedIn, ...manageMessAccess, wrapAsync(messController.renderEditForm));

module.exports = router;
