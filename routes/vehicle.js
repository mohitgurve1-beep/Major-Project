const express = require('express');
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isVehicleOwnerRole, isVehicleOwner, validateVehicle } = require("../middleware.js");

const vehicleController = require("../controllers/vehicle.js");
const multer  = require('multer');
const {storage} = require("../cloudConfig.js");
const upload = multer({storage});

router.route("/")
  .get(wrapAsync(vehicleController.index))
  .post(
    isLoggedIn,
    isVehicleOwnerRole,
    upload.array("images", 10),
    validateVehicle,
    wrapAsync(vehicleController.createVehicle),
  );

// New Route
router.get("/new", isLoggedIn, isVehicleOwnerRole, vehicleController.renderNewForm);

// Owner Vehicle Dashboard
router.get("/owner/dashboard", isLoggedIn, isVehicleOwnerRole, wrapAsync(vehicleController.renderOwnerVehicleDashboard));

router.route("/:id")
   .get(wrapAsync(vehicleController.showVehicle))
   .put(
     isLoggedIn,
     isVehicleOwnerRole,
     isVehicleOwner,
      upload.array("images", 10),
      validateVehicle,
      wrapAsync(vehicleController.updateVehicle),
   )
   .delete(isLoggedIn, isVehicleOwnerRole, isVehicleOwner, wrapAsync(vehicleController.destroyVehicle));

// Edit Route
router.get("/:id/edit", isLoggedIn, isVehicleOwnerRole, isVehicleOwner, wrapAsync(vehicleController.renderEditForm));

module.exports = router;
