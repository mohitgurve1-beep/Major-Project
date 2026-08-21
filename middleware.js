const Listing = require("./models/listing");
const Review = require("./models/review");
const Mess = require("./models/mess");
const Laundry = require("./models/laundry");
const Vehicle = require("./models/vehicle");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema, visitRequestSchema, messSchema, laundrySchema, vehicleSchema } = require("./Schema.js");
const review = require("./models/review.js");

module.exports.isLoggedIn = (req,res,next) => {
    if(!req.isAuthenticated()){
    req.session.redirectUrl = req.originalUrl;
    req.flash("error","You must be logged in to create listing.")
    return res.redirect("/login");
  }
  next();
};

module.exports.saveRedirectUrl = (req,res,next) => {
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isOwner = async (req,res,next) => {
    let {id} = req.params;
    let listing = await Listing.findById(id);
    if(!listing.owner._id.equals(res.locals.currUser._id)){
      req.flash("error","You are not the owner of this listing.");
      return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.validateListing = (req,res,next) => {
    let {error} = listingSchema.validate(req.body);
      if(error){
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400,errMsg);
      }else{
        next();
      }
};

module.exports.validateReview = (req,res,next) => {
    let {error} = reviewSchema.validate(req.body);
      if(error){
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400,errMsg);
      }else{
        next();
      }
};

module.exports.isReviewAuthor = async (req,res,next) => {
    let {id,reviewId} = req.params;
    let review = await Review.findById(reviewId);
    if(!review.author._id.equals(res.locals.currUser._id)){
      req.flash("error","You are not the author of this review.");
      return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.isAdmin = (req,res,next) => {
    if(!req.user || req.user.role !== 'admin'){
      req.flash("error","You are not authorized to perform this action.");
      return res.redirect("/listings");
    }
    next();
};

module.exports.isOwnerOrAdmin = async (req,res,next) => {
    let {id} = req.params;
    let listing = await Listing.findById(id);
    if(!listing){
      req.flash("error","Listing does not exist.");
      return res.redirect("/listings");
    }
    const isOwner = listing.owner && listing.owner._id && listing.owner._id.equals(res.locals.currUser._id);
    if(!isOwner && (!req.user || req.user.role !== 'admin')){
      req.flash("error","You are not authorized to perform this action.");
      return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.isOwnerRole = (req,res,next) => {
    if(!req.user || req.user.role !== 'owner'){
        req.flash("error","Only property owners can manage room listings.");
        return res.redirect("/listings");
    }
    next();
};

module.exports.isStudentRole = (req,res,next) => {
    if(!req.user || req.user.role !== 'student'){
        req.flash("error", "Only students can start a booking payment.");
        return res.redirect("/listings");
    }
    next();
};

module.exports.validateVisitRequest = (req,res,next) => {
    let {error} = visitRequestSchema.validate(req.body);
    if(error){
        let errMsg = error.details.map((el) => el.message).join(",");
        req.flash("error", errMsg);
        return res.redirect(`/listings/${req.params.id}`);
    }
    next();
};

module.exports.isNotOwner = async (req,res,next) => {
    let {id} = req.params;
    let listing = await Listing.findById(id);
    if(!listing){
        req.flash("error","Listing does not exist.");
        return res.redirect("/listings");
    }
    if(listing.owner && listing.owner._id && listing.owner._id.equals(res.locals.currUser._id)){
        req.flash("error","You cannot request a visit to your own room.");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.isListingOwner = async (req,res,next) => {
    let {id} = req.params;
    let listing = await Listing.findById(id);
    if(!listing){
        req.flash("error","Listing does not exist.");
        return res.redirect("/listings");
    }
    if(!listing.owner || !listing.owner._id || !listing.owner._id.equals(res.locals.currUser._id)){
        req.flash("error","You are not the owner of this listing.");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.isVisitRequestOwner = async (req,res,next) => {
    let {id, requestId} = req.params;
    let listing = await Listing.findById(id);
    if(!listing){
        req.flash("error","Listing does not exist.");
        return res.redirect("/listings");
    }
    let visitRequest = listing.visitRequests.id(requestId);
    if(!visitRequest){
        req.flash("error","Visit request not found.");
        return res.redirect(`/listings/${id}`);
    }
    if(!visitRequest.student.equals(res.locals.currUser._id)){
        req.flash("error","You are not authorized to cancel this request.");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

// =====================
// Mess Module
// =====================

module.exports.isMessOwnerRole = (req,res,next) => {
    if(!req.user || req.user.role !== 'owner'){
        req.flash("error","Only property owners can manage messes.");
        return res.redirect("/messes");
    }
    next();
};

module.exports.validateMess = (req,res,next) => {
    let {error} = messSchema.validate(req.body);
    if(error){
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else{
        next();
    }
};

module.exports.isMessOwner = async (req,res,next) => {
    let {id} = req.params;
    let mess = await Mess.findById(id);
    if(!mess){
        req.flash("error","Mess does not exist.");
        return res.redirect("/messes");
    }
    if(!mess.owner || !mess.owner._id || !mess.owner._id.equals(res.locals.currUser._id)){
        req.flash("error","You are not the owner of this mess.");
        return res.redirect(`/messes/${id}`);
    }
    next();
};

// =====================
// Laundry Module
// =====================

module.exports.isLaundryOwnerRole = (req,res,next) => {
    if(!req.user || req.user.role !== 'owner'){
        req.flash("error","Only property owners can manage laundry services.");
        return res.redirect("/laundry");
    }
    next();
};

module.exports.validateLaundry = (req,res,next) => {
    let {error} = laundrySchema.validate(req.body);
    if(error){
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else{
        next();
    }
};

module.exports.isLaundryOwner = async (req,res,next) => {
    let {id} = req.params;
    let laundry = await Laundry.findById(id);
    if(!laundry){
        req.flash("error","Laundry service does not exist.");
        return res.redirect("/laundry");
    }
    if(!laundry.owner || !laundry.owner._id || !laundry.owner._id.equals(res.locals.currUser._id)){
        req.flash("error","You are not the owner of this laundry service.");
        return res.redirect(`/laundry/${id}`);
    }
    next();
};

// =====================
// Vehicle Rental Module
// =====================

module.exports.isVehicleOwnerRole = (req,res,next) => {
    if(!req.user || req.user.role !== 'owner'){
        req.flash("error","Only property owners can manage vehicles.");
        return res.redirect("/vehicles");
    }
    next();
};

module.exports.validateVehicle = (req,res,next) => {
    let {error} = vehicleSchema.validate(req.body);
    if(error){
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else{
        next();
    }
};

module.exports.isVehicleOwner = async (req,res,next) => {
    let {id} = req.params;
    let vehicle = await Vehicle.findById(id);
    if(!vehicle){
        req.flash("error","Vehicle does not exist.");
        return res.redirect("/vehicles");
    }
    if(!vehicle.owner || !vehicle.owner._id || !vehicle.owner._id.equals(res.locals.currUser._id)){
        req.flash("error","You are not the owner of this vehicle.");
        return res.redirect(`/vehicles/${id}`);
    }
    next();
};
