const mongoose = require("mongoose");
const Listing = require("../models/listing");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const { cloudinary } = require("../cloudConfig.js");
const { notifyUser } = require("../utils/notify.js");

// Migrate old single image field to images array (backward compatibility)
const normalizeImages = (item) => {
    if (!item) return;
    if ((!item.images || item.images.length === 0) && item.image && item.image.url) {
        item.images = [{ url: item.image.url, filename: item.image.filename }];
    }
    if (!item.images) item.images = [];
};

const getGeocodingClient = () => {
    const mapToken = process.env.MAP_TOKEN;

    if (!mapToken || mapToken === "your_mapbox_public_token") {
        return null;
    }

    try {
        return mbxGeocoding({ accessToken: mapToken });
    } catch (error) {
        console.warn("Mapbox geocoding disabled:", error.message);
        return null;
    }
};

// Phase 11 — Advanced Search & Smart Filters
// Shared, whitelisted option lists used for both query building and form rendering.
const ROOM_TYPES = ['Single Room', 'Shared Room', 'PG', '1RK', '1BHK', '2BHK'];
const FURNISHING_OPTIONS = ['Fully Furnished', 'Semi Furnished', 'Unfurnished'];
const GENDER_OPTIONS = ['Boys', 'Girls', 'Anyone'];
const AVAILABILITY_OPTIONS = ['Available', 'Occupied', 'Reserved'];
const AMENITY_OPTIONS = [
    'WiFi',
    'AC',
    'Attached Bathroom',
    'Geyser',
    'Balcony',
    'Parking',
    'Security',
    'Mess/Canteen',
    'Housekeeping',
    'Furnished Bed',
    'Study Table',
    'Wardrobe',
    'Water Supply',
    'Electricity Backup',
];

// Escape regex special characters to prevent RegExp injection via search input.
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Parse an integer filter, returning null for empty/invalid values (never NaN/negative).
const parsePositiveInt = (val) => {
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
};

module.exports.index = async (req, res) => {
    // Public listing index: all rooms are public (Phase 12 — verification removed)
    // Supports optional search + smart filters (all query params are optional)
    const {
        q, location, city,
        minRent, maxRent,
        roomType, furnishing, genderPreference, availability,
        minimumStay,
        amenities, sort,
    } = req.query;

    // Phase 12 — verification removed: all listings are public/searchable.
    const filter = {};

    // --- Search (sanitized, regex-escaped) ---
    if (q && q.trim()) {
        const searchRegex = new RegExp(escapeRegExp(q.trim()), 'i');
        filter.$or = [
            { title: searchRegex },
            { description: searchRegex },
            { location: searchRegex },
            { country: searchRegex },
            { city: searchRegex },
        ];
    }

    if (location && location.trim()) {
        filter.location = new RegExp(escapeRegExp(location.trim()), 'i');
    }

    if (city && city.trim()) {
        filter.city = new RegExp(escapeRegExp(city.trim()), 'i');
    }

    // --- Monthly Rent (Min/Max) — validated, invalid ranges ignored ---
    const minRentVal = parsePositiveInt(minRent);
    const maxRentVal = parsePositiveInt(maxRent);

    if (minRentVal !== null && maxRentVal !== null) {
        if (minRentVal <= maxRentVal) {
            filter.price = { $gte: minRentVal, $lte: maxRentVal };
        }
        // else: invalid range (min > max) → ignore this filter entirely
    } else if (minRentVal !== null) {
        filter.price = { $gte: minRentVal };
    } else if (maxRentVal !== null) {
        filter.price = { $lte: maxRentVal };
    }

    // --- Enumerated filters (whitelisted only) ---
    if (ROOM_TYPES.includes(roomType)) filter.roomType = roomType;
    if (FURNISHING_OPTIONS.includes(furnishing)) filter.furnishing = furnishing;
    if (GENDER_OPTIONS.includes(genderPreference)) filter.genderPreference = genderPreference;
    if (AVAILABILITY_OPTIONS.includes(availability)) filter.availability = availability;

    // --- Minimum Stay (positive int → listing minimumStay <= requested stay) ---
    const minimumStayVal = parsePositiveInt(minimumStay);
    if (minimumStayVal !== null) {
        filter.minimumStay = { $lte: minimumStayVal };
    }

    // --- Amenities (multiple) — must include ALL selected amenities ---
    if (amenities) {
        const selectedAmenities = Array.isArray(amenities)
            ? amenities
            : [amenities];
        const sanitizedAmenities = selectedAmenities
            .filter((a) => AMENITY_OPTIONS.includes(a));
        if (sanitizedAmenities.length > 0) {
            filter.amenities = { $all: sanitizedAmenities };
        }
    }

    // --- Sort (whitelisted; default ordering preserved when no sort param) ---
    const sortOptions = {
        newest: { _id: -1 },
        oldest: { _id: 1 },
        price_asc: { price: 1, _id: -1 },
        price_desc: { price: -1, _id: -1 },
    };
    const sortQuery = sortOptions[sort] || null;

    const allListings = sortQuery
        ? await Listing.find(filter).sort(sortQuery)
        : await Listing.find(filter);

    // Phase 13 — Search result ordering: keep all existing filters/search intact.
    // The $or search query above returns only the matching listings. We then split
    // the results so matches appear first, and fetch the remaining (non-matching)
    // listings with the SAME filters minus the search clause so they appear below.
    // No duplicates, nothing hidden.
    let matchingListings = [];
    let remainingListings = [];
    let hasSearch = false;
    let matchedCount = 0;

    if (q && q.trim()) {
        hasSearch = true;
        const keyword = q.trim().toLowerCase();

        // Same matching fields used by the main search $or filter above.
        const matchesKeyword = (listing) => {
            const fields = [
                listing.title,
                listing.description,
                listing.location,
                listing.country,
                listing.city,
            ];
            return fields.some((f) => f && f.toLowerCase().includes(keyword));
        };

        matchingListings = allListings.filter(matchesKeyword);
        matchedCount = matchingListings.length;

        if (filter.$or) {
            // The $or filter already narrowed the query to matches. Fetch the rest
            // (non-matching) using the same filters without the search clause.
            const remainingFilter = { ...filter };
            delete remainingFilter.$or;
            const rest = sortQuery
                ? await Listing.find(remainingFilter).sort(sortQuery)
                : await Listing.find(remainingFilter);
            const matchIds = new Set(matchingListings.map((l) => l._id.toString()));
            remainingListings = rest.filter((l) => !matchIds.has(l._id.toString()));
        } else {
            remainingListings = allListings.filter((l) => !matchesKeyword(l));
        }
    } else {
        remainingListings = allListings;
    }

    const finalListings = [...matchingListings, ...remainingListings];

    // Stats for hero section (Phase 12 — all listings counted, no verification filter)
    const totalRooms = await Listing.countDocuments({});
    const totalOwners = await require('../models/user').countDocuments({ role: 'owner' });
    const totalStudents = await require('../models/user').countDocuments({ role: 'student' });

    // Featured rooms (a few recent listings for showcase)
    const featuredRooms = await Listing.find({})
        .sort({ _id: -1 })
        .limit(6);

    // Testimonials data (static — can be made dynamic later)
    const testimonials = [
        {
            name: 'Rahul Sharma',
            role: 'Student, IIT Bombay',
            text: 'Student Accommodation made my hostel search so easy. I found the perfect PG near my college within a week!',
            rating: 5,
        },
        {
            name: 'Priya Patel',
            role: 'Student, Delhi University',
            text: 'Student Accommodation made my hostel search so easy. I found the perfect PG near my college within a week!',
            rating: 5,
        },
        {
            name: 'Amit Singh',
            role: 'Student, VIT Vellore',
            text: 'I love the visit request feature. I can schedule visits without any hassle. Highly recommended for students!',
            rating: 4,
        },
    ];

    // Build the active-filter chips (for UI display + per-chip removal)
    const activeFilters = [];

    const addFilterChip = (label, paramName, paramValue) => {
        const removal = new URLSearchParams(req.query);
        removal.delete(paramName);
        if (paramName === 'minRent') removal.delete('maxRent');
        if (paramName === 'maxRent') removal.delete('minRent');
        if (paramName === 'amenities') {
            const others = (Array.isArray(amenities) ? amenities : [amenities])
                .filter((a) => a !== paramValue);
            removal.delete('amenities');
            others.forEach((a) => removal.append('amenities', a));
        }
        activeFilters.push({ label, href: `/listings?${removal.toString()}` });
    };

    if (q && q.trim()) addFilterChip(`Search: "${q.trim()}"`, 'q', q);
    if (location && location.trim()) addFilterChip(`Location: ${location.trim()}`, 'location', location);
    if (city && city.trim()) addFilterChip(`City: ${city.trim()}`, 'city', city);
    if (minRentVal !== null) addFilterChip(`Min rent: ₹${minRentVal}`, 'minRent', minRentVal);
    if (maxRentVal !== null) addFilterChip(`Max rent: ₹${maxRentVal}`, 'maxRent', maxRentVal);
    if (roomType && ROOM_TYPES.includes(roomType)) addFilterChip(roomType, 'roomType', roomType);
    if (furnishing && FURNISHING_OPTIONS.includes(furnishing)) addFilterChip(furnishing, 'furnishing', furnishing);
    if (genderPreference && GENDER_OPTIONS.includes(genderPreference)) addFilterChip(genderPreference, 'genderPreference', genderPreference);
    if (availability && AVAILABILITY_OPTIONS.includes(availability)) addFilterChip(availability, 'availability', availability);
    if (minimumStayVal !== null) addFilterChip(`Min stay: ${minimumStayVal}+ months`, 'minimumStay', minimumStayVal);
    if (sort && sortOptions[sort]) addFilterChip(`Sort: ${sort.replace(/_/g, ' ')}`, 'sort', sort);

    const selectedAmenities = Array.isArray(amenities)
        ? amenities.filter((a) => AMENITY_OPTIONS.includes(a))
        : (amenities ? [amenities].filter((a) => AMENITY_OPTIONS.includes(a)) : []);

    res.render("listings/index.ejs", {
        allListings,
        finalListings,
        matchingListings,
        remainingListings,
        hasSearch,
        matchedCount,
        q: q || '',
        location: location || '',
        stats: { totalRooms, totalOwners, totalStudents },
        featuredRooms,
        testimonials,
        // Phase 11 — filter locals
        filters: {
            q: q || '',
            location: location || '',
            city: city || '',
            minRent: minRentVal !== null ? minRentVal : '',
            maxRent: maxRentVal !== null ? maxRentVal : '',
            roomType: ROOM_TYPES.includes(roomType) ? roomType : '',
            furnishing: FURNISHING_OPTIONS.includes(furnishing) ? furnishing : '',
            genderPreference: GENDER_OPTIONS.includes(genderPreference) ? genderPreference : '',
            availability: AVAILABILITY_OPTIONS.includes(availability) ? availability : '',
            minimumStay: minimumStayVal !== null ? minimumStayVal : '',
            amenities: selectedAmenities,
            sort: sortOptions[sort] ? sort : '',
        },
        roomTypes: ROOM_TYPES,
        furnishingOptions: FURNISHING_OPTIONS,
        genderOptions: GENDER_OPTIONS,
        availabilityOptions: AVAILABILITY_OPTIONS,
        amenityOptions: AMENITY_OPTIONS,
        activeFilters,
        resultsCount: allListings.length,
    });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs", {
        roomTypes: ROOM_TYPES,
        furnishingOptions: FURNISHING_OPTIONS,
        genderOptions: GENDER_OPTIONS,
        availabilityOptions: AVAILABILITY_OPTIONS,
        amenityOptions: AMENITY_OPTIONS,
    });
};

module.exports.showListing = async (req, res) => {
    let { id } = req.params;

    // Guard against non-ObjectId paths (e.g. legacy /listings/admin) → treat as not found.
    if (!mongoose.isValidObjectId(id)) {
        req.flash("error", "Listing you requested does not exist!");
        return res.redirect("/listings");
    }

    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Listing you requested does not exist!");
        return res.redirect("/listings");
    }

    // Phase 12 — verification removed: all listings are publicly viewable.
    const isOwnerOfListing = listing.owner && listing.owner._id && req.user && listing.owner._id.equals(req.user._id);

    // Check if current user has an existing pending visit request for this listing
    let existingRequest = null;
    if (req.user && !isOwnerOfListing) {
        existingRequest = listing.visitRequests.find(
            (vr) => vr.student && vr.student.toString() === req.user._id.toString() && vr.status === 'pending'
        );
    }

    res.render("listings/show.ejs", { listing, existingRequest });
};

module.exports.createListing = async (req, res) => {
    let geometry = {
        type: "Point",
        coordinates: [0, 0],
    };

    const geocodingClient = getGeocodingClient();

    if (geocodingClient && req.body.listing?.location) {
        try {
            const response = await geocodingClient
                .forwardGeocode({
                    query: req.body.listing.location,
                    limit: 1,
                })
                .send();

            if (response?.body?.features?.length) {
                geometry = {
                    type: "Point",
                    coordinates: response.body.features[0].geometry.coordinates,
                };
            }
        } catch (error) {
            console.warn("Geocoding failed:", error.message);
        }
    }

    const newListing = new Listing(req.body.listing);

    newListing.owner = req.user._id;
    newListing.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    if (newListing.images.length > 0) {
        newListing.image = { url: newListing.images[0].url, filename: newListing.images[0].filename };
    }
    newListing.geometry = geometry;

    await newListing.save();

    req.flash("success", "New Listing Created! It is now live.");
    res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing you requested does not exist!");
        return res.redirect("/listings");
    }

    normalizeImages(listing);

    res.render("listings/edit.ejs", {
        listing,
        roomTypes: ROOM_TYPES,
        furnishingOptions: FURNISHING_OPTIONS,
        genderOptions: GENDER_OPTIONS,
        availabilityOptions: AVAILABILITY_OPTIONS,
        amenityOptions: AMENITY_OPTIONS,
    });
};

module.exports.updateListing = async (req, res) => {
    let { id } = req.params;

    let listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing you requested does not exist!");
        return res.redirect("/listings");
    }

    Object.assign(listing, req.body.listing);

    // Handle image deletion
    if (req.body.deleteImages && req.body.deleteImages.length > 0) {
        const deleteIds = Array.isArray(req.body.deleteImages) ? req.body.deleteImages : [req.body.deleteImages];
        for (let filename of deleteIds) {
            await cloudinary.uploader.destroy(filename);
        }
        listing.images = listing.images.filter(img => !deleteIds.includes(img.filename));
    }

    // Add newly uploaded images
    if (req.files && req.files.length > 0) {
        const newImages = req.files.map(f => ({ url: f.path, filename: f.filename }));
        listing.images.push(...newImages);
    }

    // Sync backward-compat image field
    if (listing.images.length > 0) {
        listing.image = { url: listing.images[0].url, filename: listing.images[0].filename };
    }

    await listing.save();

    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
    let { id } = req.params;

    const listing = await Listing.findById(id);
    if (listing) {
        // Clean up all Cloudinary images
        for (let img of listing.images) {
            if (img.filename) {
                await cloudinary.uploader.destroy(img.filename);
            }
        }
        await Listing.findByIdAndDelete(id);
    }

    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
};

// =====================
// Owner Dashboard
// =====================

module.exports.renderOwnerDashboard = async (req, res) => {
    const ownerId = req.user._id;
    const allListings = await Listing.find({ owner: ownerId }).populate("owner");

    const totalRooms = allListings.length;

    res.render("listings/ownerDashboard.ejs", {
        allListings,
        totalRooms,
    });
};

// =====================
// Visit Request System
// =====================

module.exports.sendVisitRequest = async (req, res) => {
    let { id } = req.params;
    let { date, time, message } = req.body.visitRequest;

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }

    // Check for duplicate pending request
    const existingRequest = listing.visitRequests.find(
        (vr) => vr.student && vr.student.toString() === req.user._id.toString() && vr.status === 'pending'
    );

    if (existingRequest) {
        req.flash("error", "You already have a pending visit request for this room.");
        return res.redirect(`/listings/${id}`);
    }

    listing.visitRequests.push({
        student: req.user._id,
        date: new Date(date),
        time,
        message: message || '',
        status: 'pending',
        createdAt: new Date(),
    });

    await listing.save();

    // Notify the room owner about the new visit request
    await notifyUser({
        recipient: listing.owner,
        actor: req.user._id,
        type: 'new_visit_request',
        title: 'New Visit Request',
        message: `${req.user.username} requested a visit to "${listing.title}".`,
        link: `/listings/owner/visit-requests`,
    });

    req.flash("success", "Visit request sent successfully!");
    res.redirect(`/listings/${id}`);
};

module.exports.cancelVisitRequest = async (req, res) => {
    let { id, requestId } = req.params;

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }

    const visitRequest = listing.visitRequests.id(requestId);

    if (!visitRequest) {
        req.flash("error", "Visit request not found.");
        return res.redirect(`/listings/${id}`);
    }

    visitRequest.status = 'cancelled';
    await listing.save();

    // Notify the room owner about the cancellation
    await notifyUser({
        recipient: listing.owner,
        actor: req.user._id,
        type: 'visit_cancelled',
        title: 'Visit Request Cancelled',
        message: `A visit request for "${listing.title}" was cancelled.`,
        link: `/listings/owner/visit-requests`,
    });

    req.flash("success", "Visit request cancelled.");
    res.redirect(`/listings/${id}`);
};

module.exports.getOwnerVisitRequests = async (req, res) => {
    const ownerId = req.user._id;

    // Find all listings owned by this user
    const ownerListings = await Listing.find({ owner: ownerId })
        .populate({
            path: 'visitRequests.student',
            select: 'username email',
        })
        .select('title visitRequests');

    // Flatten visit requests with listing info
    const allVisitRequests = [];
    for (const listing of ownerListings) {
        for (const request of listing.visitRequests) {
            if (request.status !== 'cancelled') {
                allVisitRequests.push({
                    _id: request._id,
                    listingId: listing._id,
                    listingTitle: listing.title,
                    student: request.student,
                    date: request.date,
                    time: request.time,
                    message: request.message,
                    status: request.status,
                    createdAt: request.createdAt,
                });
            }
        }
    }

    // Sort by most recent first
    allVisitRequests.sort((a, b) => b.createdAt - a.createdAt);

    res.render("listings/ownerVisitRequests.ejs", {
        allVisitRequests,
    });
};

module.exports.updateVisitRequestStatus = async (req, res) => {
    let { id, requestId } = req.params;
    let { status } = req.body;

    // Only allow valid status transitions from owner
    const validStatuses = ['accepted', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
        req.flash("error", "Invalid status update.");
        return res.redirect(`/listings/owner/visit-requests`);
    }

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect(`/listings/owner/visit-requests`);
    }

    const visitRequest = listing.visitRequests.id(requestId);

    if (!visitRequest) {
        req.flash("error", "Visit request not found.");
        return res.redirect(`/listings/owner/visit-requests`);
    }

    if (visitRequest.status === 'cancelled') {
        req.flash("error", "Cannot update a cancelled request.");
        return res.redirect(`/listings/owner/visit-requests`);
    }

    visitRequest.status = status;
    await listing.save();

    // Notify the student about the decision
    if (status === 'accepted') {
        await notifyUser({
            recipient: visitRequest.student,
            actor: req.user._id,
            type: 'visit_request_accepted',
            title: 'Visit Request Accepted',
            message: `Your visit request for "${listing.title}" was accepted.`,
            link: `/listings/${id}`,
        });
    } else if (status === 'rejected') {
        await notifyUser({
            recipient: visitRequest.student,
            actor: req.user._id,
            type: 'visit_request_rejected',
            title: 'Visit Request Rejected',
            message: `Your visit request for "${listing.title}" was rejected.`,
            link: `/listings/${id}`,
        });
    }

    req.flash("success", `Visit request ${status} successfully!`);
    res.redirect(`/listings/owner/visit-requests`);
};
