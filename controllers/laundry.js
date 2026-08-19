const mongoose = require("mongoose");
const Laundry = require("../models/laundry");

// Admin-visible options for select dropdowns
const AVAILABILITY_OPTIONS = ['Available', 'Closed'];

// Escape regex special characters to prevent RegExp injection via search input.
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Parse an integer filter, returning null for empty/invalid values.
const parsePositiveInt = (val) => {
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
};

// Convert checkbox "on" → true, missing/'' → false (works with Joi truthy/falsy too)
const boolFromForm = (val) => val === 'on' || val === true || val === 'true';

module.exports.index = async (req, res) => {
    const {
        q, city, location,
        minPrice, maxPrice,
        pickup, delivery, sameDay,
        availability,
    } = req.query;

    const filter = {};

    // --- Search (sanitized, regex-escaped) ---
    if (q && q.trim()) {
        const searchRegex = new RegExp(escapeRegExp(q.trim()), 'i');
        filter.$or = [
            { name: searchRegex },
            { description: searchRegex },
            { address: searchRegex },
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

    // --- Price (Min/Max) — based on wash & fold price, validated, invalid ranges ignored ---
    const minPriceVal = parsePositiveInt(minPrice);
    const maxPriceVal = parsePositiveInt(maxPrice);

    if (minPriceVal !== null && maxPriceVal !== null) {
        if (minPriceVal <= maxPriceVal) {
            filter.washFoldPrice = { $gte: minPriceVal, $lte: maxPriceVal };
        }
    } else if (minPriceVal !== null) {
        filter.washFoldPrice = { $gte: minPriceVal };
    } else if (maxPriceVal !== null) {
        filter.washFoldPrice = { $lte: maxPriceVal };
    }

    // --- Boolean filters (only when explicitly "on"/"true") ---
    if (pickup === 'on' || pickup === 'true') filter.pickupAvailable = true;
    if (delivery === 'on' || delivery === 'true') filter.deliveryAvailable = true;
    if (sameDay === 'on' || sameDay === 'true') filter.sameDayService = true;

    // --- Enumerated filters (whitelisted only) ---
    if (AVAILABILITY_OPTIONS.includes(availability)) filter.availability = availability;

    const allLaundries = await Laundry.find(filter).populate("owner");

    // Stats for hero
    const totalLaundries = await Laundry.countDocuments({});
    const totalCities = await Laundry.distinct('city');
    const totalOwners = await require('../models/user').countDocuments({ role: 'owner' });

    // Build active-filter chips (for UI display + per-chip removal)
    const activeFilters = [];

    const addFilterChip = (label, paramName, paramValue) => {
        const removal = new URLSearchParams(req.query);
        removal.delete(paramName);
        if (paramName === 'minPrice') removal.delete('maxPrice');
        if (paramName === 'maxPrice') removal.delete('minPrice');
        activeFilters.push({ label, href: `/laundry?${removal.toString()}` });
    };

    if (q && q.trim()) addFilterChip(`Search: "${q.trim()}"`, 'q', q);
    if (city && city.trim()) addFilterChip(`City: ${city.trim()}`, 'city', city);
    if (location && location.trim()) addFilterChip(`Area: ${location.trim()}`, 'location', location);
    if (minPriceVal !== null) addFilterChip(`Min price: ₹${minPriceVal}`, 'minPrice', minPriceVal);
    if (maxPriceVal !== null) addFilterChip(`Max price: ₹${maxPriceVal}`, 'maxPrice', maxPriceVal);
    if (pickup === 'on' || pickup === 'true') addFilterChip('Pickup Available', 'pickup', pickup);
    if (delivery === 'on' || delivery === 'true') addFilterChip('Delivery Available', 'delivery', delivery);
    if (sameDay === 'on' || sameDay === 'true') addFilterChip('Same Day Service', 'sameDay', sameDay);
    if (availability && AVAILABILITY_OPTIONS.includes(availability)) addFilterChip(availability, 'availability', availability);

    res.render("laundry/index.ejs", {
        allLaundries,
        stats: { totalLaundries, totalCities: totalCities.length, totalOwners },
        filters: {
            q: q || '',
            city: city || '',
            location: location || '',
            minPrice: minPriceVal !== null ? minPriceVal : '',
            maxPrice: maxPriceVal !== null ? maxPriceVal : '',
            pickup: pickup === 'on' || pickup === 'true' ? 'on' : '',
            delivery: delivery === 'on' || delivery === 'true' ? 'on' : '',
            sameDay: sameDay === 'on' || sameDay === 'true' ? 'on' : '',
            availability: AVAILABILITY_OPTIONS.includes(availability) ? availability : '',
        },
        availabilityOptions: AVAILABILITY_OPTIONS,
        activeFilters,
        resultsCount: allLaundries.length,
    });
};

module.exports.renderNewForm = (req, res) => {
    res.render("laundry/new.ejs", {
        availabilityOptions: AVAILABILITY_OPTIONS,
    });
};

module.exports.showLaundry = async (req, res) => {
    let { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        req.flash("error", "Laundry service you requested does not exist!");
        return res.redirect("/laundry");
    }

    const laundry = await Laundry.findById(id).populate("owner");

    if (!laundry) {
        req.flash("error", "Laundry service you requested does not exist!");
        return res.redirect("/laundry");
    }

    const isOwnerOfLaundry = laundry.owner && laundry.owner._id && req.user && laundry.owner._id.equals(req.user._id);

    res.render("laundry/show.ejs", { laundry, isOwnerOfLaundry });
};

module.exports.createLaundry = async (req, res) => {
    const url = req.file.path;
    const filename = req.file.filename;

    const newLaundry = new Laundry(req.body.laundry);

    newLaundry.owner = req.user._id;
    newLaundry.image = { url, filename };
    newLaundry.pickupAvailable = boolFromForm(req.body.laundry?.pickupAvailable);
    newLaundry.deliveryAvailable = boolFromForm(req.body.laundry?.deliveryAvailable);
    newLaundry.sameDayService = boolFromForm(req.body.laundry?.sameDayService);

    await newLaundry.save();

    req.flash("success", "New Laundry Service Created! It is now live.");
    res.redirect("/laundry");
};

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;

    const laundry = await Laundry.findById(id);

    if (!laundry) {
        req.flash("error", "Laundry service you requested does not exist!");
        return res.redirect("/laundry");
    }

    let originalImageUrl = laundry.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");

    res.render("laundry/edit.ejs", {
        laundry,
        originalImageUrl,
        availabilityOptions: AVAILABILITY_OPTIONS,
    });
};

module.exports.updateLaundry = async (req, res) => {
    let { id } = req.params;

    let laundry = await Laundry.findByIdAndUpdate(id, {
        ...req.body.laundry,
    });

    if (req.file) {
        laundry.image = {
            url: req.file.path,
            filename: req.file.filename,
        };
    }
    laundry.pickupAvailable = boolFromForm(req.body.laundry?.pickupAvailable);
    laundry.deliveryAvailable = boolFromForm(req.body.laundry?.deliveryAvailable);
    laundry.sameDayService = boolFromForm(req.body.laundry?.sameDayService);

    await laundry.save();

    req.flash("success", "Laundry Service Updated!");
    res.redirect(`/laundry/${id}`);
};

module.exports.destroyLaundry = async (req, res) => {
    let { id } = req.params;

    await Laundry.findByIdAndDelete(id);

    req.flash("success", "Laundry Service Deleted!");
    res.redirect("/laundry");
};

// =====================
// Owner Laundry Dashboard
// =====================

module.exports.renderOwnerLaundryDashboard = async (req, res) => {
    const ownerId = req.user._id;
    const allLaundries = await Laundry.find({ owner: ownerId }).populate("owner");

    const totalLaundries = allLaundries.length;
    const availableCount = allLaundries.filter((l) => l.availability === 'Available').length;
    const closedCount = totalLaundries - availableCount;

    res.render("laundry/ownerDashboard.ejs", {
        allLaundries,
        totalLaundries,
        availableCount,
        closedCount,
    });
};
