const mongoose = require("mongoose");
const Vehicle = require("../models/vehicle");
const { cloudinary } = require("../cloudConfig.js");

// Migrate old single image field to images array (backward compatibility)
const normalizeImages = (item) => {
    if (!item) return;
    if ((!item.images || item.images.length === 0) && item.image && item.image.url) {
        item.images = [{ url: item.image.url, filename: item.image.filename }];
    }
    if (!item.images) item.images = [];
};

// Admin-visible options for select dropdowns
const VEHICLE_TYPES = ['Car', 'Bike', 'Scooter'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG'];
const GEAR_TYPES = ['Manual', 'Automatic'];
const AVAILABILITY_OPTIONS = ['Available', 'Rented', 'Maintenance'];

// Escape regex special characters to prevent RegExp injection via search input.
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Parse an integer filter, returning null for empty/invalid values.
const parsePositiveInt = (val) => {
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
};

module.exports.index = async (req, res) => {
    const {
        q, city, location,
        minPrice, maxPrice,
        vehicleType, fuelType, gearType,
        availability,
    } = req.query;

    const filter = {};

    // --- Search (sanitized, regex-escaped) ---
    if (q && q.trim()) {
        const searchRegex = new RegExp(escapeRegExp(q.trim()), 'i');
        filter.$or = [
            { name: searchRegex },
            { description: searchRegex },
            { brand: searchRegex },
            { model: searchRegex },
            { city: searchRegex },
            { location: searchRegex },
        ];
    }

    if (city && city.trim()) {
        filter.city = new RegExp(escapeRegExp(city.trim()), 'i');
    }

    if (location && location.trim()) {
        filter.location = new RegExp(escapeRegExp(location.trim()), 'i');
    }

    // --- Daily Price (Min/Max) — validated, invalid ranges ignored ---
    const minPriceVal = parsePositiveInt(minPrice);
    const maxPriceVal = parsePositiveInt(maxPrice);

    if (minPriceVal !== null && maxPriceVal !== null) {
        if (minPriceVal <= maxPriceVal) {
            filter.dailyPrice = { $gte: minPriceVal, $lte: maxPriceVal };
        }
    } else if (minPriceVal !== null) {
        filter.dailyPrice = { $gte: minPriceVal };
    } else if (maxPriceVal !== null) {
        filter.dailyPrice = { $lte: maxPriceVal };
    }

    // --- Enumerated filters (whitelisted only) ---
    if (VEHICLE_TYPES.includes(vehicleType)) filter.vehicleType = vehicleType;
    if (FUEL_TYPES.includes(fuelType)) filter.fuelType = fuelType;
    if (GEAR_TYPES.includes(gearType)) filter.gearType = gearType;
    if (AVAILABILITY_OPTIONS.includes(availability)) filter.availability = availability;

    const allVehicles = await Vehicle.find(filter).populate("owner");

    // Stats for hero
    const totalVehicles = await Vehicle.countDocuments({});
    const totalCities = await Vehicle.distinct('city');
    const totalOwners = await require('../models/user').countDocuments({ role: 'owner' });

    // Build active-filter chips (for UI display + per-chip removal)
    const activeFilters = [];

    const addFilterChip = (label, paramName, paramValue) => {
        const removal = new URLSearchParams(req.query);
        removal.delete(paramName);
        if (paramName === 'minPrice') removal.delete('maxPrice');
        if (paramName === 'maxPrice') removal.delete('minPrice');
        activeFilters.push({ label, href: `/vehicles?${removal.toString()}` });
    };

    if (q && q.trim()) addFilterChip(`Search: "${q.trim()}"`, 'q', q);
    if (city && city.trim()) addFilterChip(`City: ${city.trim()}`, 'city', city);
    if (location && location.trim()) addFilterChip(`Area: ${location.trim()}`, 'location', location);
    if (minPriceVal !== null) addFilterChip(`Min price: ₹${minPriceVal}`, 'minPrice', minPriceVal);
    if (maxPriceVal !== null) addFilterChip(`Max price: ₹${maxPriceVal}`, 'maxPrice', maxPriceVal);
    if (vehicleType && VEHICLE_TYPES.includes(vehicleType)) addFilterChip(vehicleType, 'vehicleType', vehicleType);
    if (fuelType && FUEL_TYPES.includes(fuelType)) addFilterChip(fuelType, 'fuelType', fuelType);
    if (gearType && GEAR_TYPES.includes(gearType)) addFilterChip(gearType, 'gearType', gearType);
    if (availability && AVAILABILITY_OPTIONS.includes(availability)) addFilterChip(availability, 'availability', availability);

    res.render("vehicles/index.ejs", {
        allVehicles,
        stats: { totalVehicles, totalCities: totalCities.length, totalOwners },
        filters: {
            q: q || '',
            city: city || '',
            location: location || '',
            minPrice: minPriceVal !== null ? minPriceVal : '',
            maxPrice: maxPriceVal !== null ? maxPriceVal : '',
            vehicleType: VEHICLE_TYPES.includes(vehicleType) ? vehicleType : '',
            fuelType: FUEL_TYPES.includes(fuelType) ? fuelType : '',
            gearType: GEAR_TYPES.includes(gearType) ? gearType : '',
            availability: AVAILABILITY_OPTIONS.includes(availability) ? availability : '',
        },
        vehicleTypes: VEHICLE_TYPES,
        fuelTypes: FUEL_TYPES,
        gearTypes: GEAR_TYPES,
        availabilityOptions: AVAILABILITY_OPTIONS,
        activeFilters,
        resultsCount: allVehicles.length,
    });
};

module.exports.renderNewForm = (req, res) => {
    res.render("vehicles/new.ejs", {
        vehicleTypes: VEHICLE_TYPES,
        fuelTypes: FUEL_TYPES,
        gearTypes: GEAR_TYPES,
        availabilityOptions: AVAILABILITY_OPTIONS,
    });
};

module.exports.showVehicle = async (req, res) => {
    let { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        req.flash("error", "Vehicle you requested does not exist!");
        return res.redirect("/vehicles");
    }

    const vehicle = await Vehicle.findById(id).populate("owner");

    if (!vehicle) {
        req.flash("error", "Vehicle you requested does not exist!");
        return res.redirect("/vehicles");
    }

    const isOwnerOfVehicle = vehicle.owner && vehicle.owner._id && req.user && vehicle.owner._id.equals(req.user._id);

    res.render("vehicles/show.ejs", { vehicle, isOwnerOfVehicle });
};

module.exports.createVehicle = async (req, res) => {
    const newVehicle = new Vehicle(req.body.vehicle);

    newVehicle.owner = req.user._id;
    newVehicle.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    if (newVehicle.images.length > 0) {
        newVehicle.image = { url: newVehicle.images[0].url, filename: newVehicle.images[0].filename };
    }

    await newVehicle.save();

    req.flash("success", "New Vehicle Added! It is now live.");
    res.redirect("/vehicles");
};

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;

    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
        req.flash("error", "Vehicle you requested does not exist!");
        return res.redirect("/vehicles");
    }

    normalizeImages(vehicle);

    res.render("vehicles/edit.ejs", {
        vehicle,
        vehicleTypes: VEHICLE_TYPES,
        fuelTypes: FUEL_TYPES,
        gearTypes: GEAR_TYPES,
        availabilityOptions: AVAILABILITY_OPTIONS,
    });
};

module.exports.updateVehicle = async (req, res) => {
    let { id } = req.params;

    let vehicle = await Vehicle.findById(id);

    if (!vehicle) {
        req.flash("error", "Vehicle you requested does not exist!");
        return res.redirect("/vehicles");
    }

    Object.assign(vehicle, req.body.vehicle);

    // Handle image deletion
    if (req.body.deleteImages && req.body.deleteImages.length > 0) {
        const deleteIds = Array.isArray(req.body.deleteImages) ? req.body.deleteImages : [req.body.deleteImages];
        for (let filename of deleteIds) {
            await cloudinary.uploader.destroy(filename);
        }
        vehicle.images = vehicle.images.filter(img => !deleteIds.includes(img.filename));
    }

    // Add newly uploaded images
    if (req.files && req.files.length > 0) {
        const newImages = req.files.map(f => ({ url: f.path, filename: f.filename }));
        vehicle.images.push(...newImages);
    }

    // Sync backward-compat image field
    if (vehicle.images.length > 0) {
        vehicle.image = { url: vehicle.images[0].url, filename: vehicle.images[0].filename };
    }

    await vehicle.save();

    req.flash("success", "Vehicle Updated!");
    res.redirect(`/vehicles/${id}`);
};

module.exports.destroyVehicle = async (req, res) => {
    let { id } = req.params;

    const vehicle = await Vehicle.findById(id);
    if (vehicle) {
        for (let img of vehicle.images) {
            if (img.filename) {
                await cloudinary.uploader.destroy(img.filename);
            }
        }
        await Vehicle.findByIdAndDelete(id);
    }

    req.flash("success", "Vehicle Deleted!");
    res.redirect("/vehicles");
};

// =====================
// Owner Vehicle Dashboard
// =====================

module.exports.renderOwnerVehicleDashboard = async (req, res) => {
    const ownerId = req.user._id;
    const allVehicles = await Vehicle.find({ owner: ownerId }).populate("owner");

    const totalVehicles = allVehicles.length;
    const availableCount = allVehicles.filter((v) => v.availability === 'Available').length;
    const rentedCount = allVehicles.filter((v) => v.availability === 'Rented').length;
    const maintenanceCount = totalVehicles - availableCount - rentedCount;

    res.render("vehicles/ownerDashboard.ejs", {
        allVehicles,
        totalVehicles,
        availableCount,
        rentedCount,
        maintenanceCount,
    });
};
