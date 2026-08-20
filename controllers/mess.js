const mongoose = require("mongoose");
const Mess = require("../models/mess");
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
const MEAL_TYPES = ['Veg', 'Non-Veg', 'Both'];
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
        mealType, availability,
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

    // --- Monthly Price (Min/Max) — validated, invalid ranges ignored ---
    const minPriceVal = parsePositiveInt(minPrice);
    const maxPriceVal = parsePositiveInt(maxPrice);

    if (minPriceVal !== null && maxPriceVal !== null) {
        if (minPriceVal <= maxPriceVal) {
            filter.monthlyPrice = { $gte: minPriceVal, $lte: maxPriceVal };
        }
    } else if (minPriceVal !== null) {
        filter.monthlyPrice = { $gte: minPriceVal };
    } else if (maxPriceVal !== null) {
        filter.monthlyPrice = { $lte: maxPriceVal };
    }

    // --- Enumerated filters (whitelisted only) ---
    if (MEAL_TYPES.includes(mealType)) filter.mealType = mealType;
    if (AVAILABILITY_OPTIONS.includes(availability)) filter.availability = availability;

    const allMesses = await Mess.find(filter).populate("owner");

    // Stats for hero
    const totalMesses = await Mess.countDocuments({});
    const totalCities = await Mess.distinct('city');
    const totalOwners = await require('../models/user').countDocuments({ role: 'owner' });

    // Build active-filter chips (for UI display + per-chip removal)
    const activeFilters = [];

    const addFilterChip = (label, paramName, paramValue) => {
        const removal = new URLSearchParams(req.query);
        removal.delete(paramName);
        if (paramName === 'minPrice') removal.delete('maxPrice');
        if (paramName === 'maxPrice') removal.delete('minPrice');
        activeFilters.push({ label, href: `/messes?${removal.toString()}` });
    };

    if (q && q.trim()) addFilterChip(`Search: "${q.trim()}"`, 'q', q);
    if (city && city.trim()) addFilterChip(`City: ${city.trim()}`, 'city', city);
    if (location && location.trim()) addFilterChip(`Area: ${location.trim()}`, 'location', location);
    if (minPriceVal !== null) addFilterChip(`Min price: ₹${minPriceVal}`, 'minPrice', minPriceVal);
    if (maxPriceVal !== null) addFilterChip(`Max price: ₹${maxPriceVal}`, 'maxPrice', maxPriceVal);
    if (mealType && MEAL_TYPES.includes(mealType)) addFilterChip(mealType, 'mealType', mealType);
    if (availability && AVAILABILITY_OPTIONS.includes(availability)) addFilterChip(availability, 'availability', availability);

    res.render("mess/index.ejs", {
        allMesses,
        stats: { totalMesses, totalCities: totalCities.length, totalOwners },
        filters: {
            q: q || '',
            city: city || '',
            location: location || '',
            minPrice: minPriceVal !== null ? minPriceVal : '',
            maxPrice: maxPriceVal !== null ? maxPriceVal : '',
            mealType: MEAL_TYPES.includes(mealType) ? mealType : '',
            availability: AVAILABILITY_OPTIONS.includes(availability) ? availability : '',
        },
        mealTypes: MEAL_TYPES,
        availabilityOptions: AVAILABILITY_OPTIONS,
        activeFilters,
        resultsCount: allMesses.length,
    });
};

module.exports.renderNewForm = (req, res) => {
    res.render("mess/new.ejs", {
        mealTypes: MEAL_TYPES,
        availabilityOptions: AVAILABILITY_OPTIONS,
    });
};

module.exports.showMess = async (req, res) => {
    let { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        req.flash("error", "Mess you requested does not exist!");
        return res.redirect("/messes");
    }

    const mess = await Mess.findById(id).populate("owner");

    if (!mess) {
        req.flash("error", "Mess you requested does not exist!");
        return res.redirect("/messes");
    }

    const isOwnerOfMess = mess.owner && mess.owner._id && req.user && mess.owner._id.equals(req.user._id);

    res.render("mess/show.ejs", { mess, isOwnerOfMess });
};

module.exports.createMess = async (req, res) => {
    const newMess = new Mess(req.body.mess);

    newMess.owner = req.user._id;
    newMess.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    if (newMess.images.length > 0) {
        newMess.image = { url: newMess.images[0].url, filename: newMess.images[0].filename };
    }
    newMess.breakfast = boolFromForm(req.body.mess?.breakfast);
    newMess.lunch = boolFromForm(req.body.mess?.lunch);
    newMess.dinner = boolFromForm(req.body.mess?.dinner);

    await newMess.save();

    req.flash("success", "New Mess Created! It is now live.");
    res.redirect("/messes");
};

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;

    const mess = await Mess.findById(id);

    if (!mess) {
        req.flash("error", "Mess you requested does not exist!");
        return res.redirect("/messes");
    }

    normalizeImages(mess);

    res.render("mess/edit.ejs", {
        mess,
        mealTypes: MEAL_TYPES,
        availabilityOptions: AVAILABILITY_OPTIONS,
    });
};

module.exports.updateMess = async (req, res) => {
    let { id } = req.params;

    let mess = await Mess.findById(id);

    if (!mess) {
        req.flash("error", "Mess you requested does not exist!");
        return res.redirect("/messes");
    }

    Object.assign(mess, req.body.mess);

    // Handle image deletion
    if (req.body.deleteImages && req.body.deleteImages.length > 0) {
        const deleteIds = Array.isArray(req.body.deleteImages) ? req.body.deleteImages : [req.body.deleteImages];
        for (let filename of deleteIds) {
            await cloudinary.uploader.destroy(filename);
        }
        mess.images = mess.images.filter(img => !deleteIds.includes(img.filename));
    }

    // Add newly uploaded images
    if (req.files && req.files.length > 0) {
        const newImages = req.files.map(f => ({ url: f.path, filename: f.filename }));
        mess.images.push(...newImages);
    }

    // Sync backward-compat image field
    if (mess.images.length > 0) {
        mess.image = { url: mess.images[0].url, filename: mess.images[0].filename };
    }

    mess.breakfast = boolFromForm(req.body.mess?.breakfast);
    mess.lunch = boolFromForm(req.body.mess?.lunch);
    mess.dinner = boolFromForm(req.body.mess?.dinner);

    await mess.save();

    req.flash("success", "Mess Updated!");
    res.redirect(`/messes/${id}`);
};

module.exports.destroyMess = async (req, res) => {
    let { id } = req.params;

    const mess = await Mess.findById(id);
    if (mess) {
        for (let img of mess.images) {
            if (img.filename) {
                await cloudinary.uploader.destroy(img.filename);
            }
        }
        await Mess.findByIdAndDelete(id);
    }

    req.flash("success", "Mess Deleted!");
    res.redirect("/messes");
};

// =====================
// Owner Mess Dashboard
// =====================

module.exports.renderOwnerMessDashboard = async (req, res) => {
    const ownerId = req.user._id;
    const allMesses = await Mess.find({ owner: ownerId }).populate("owner");

    const totalMesses = allMesses.length;
    const availableCount = allMesses.filter((m) => m.availability === 'Available').length;
    const closedCount = totalMesses - availableCount;

    res.render("mess/ownerDashboard.ejs", {
        allMesses,
        totalMesses,
        availableCount,
        closedCount,
    });
};

