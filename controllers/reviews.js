const Listing = require("../models/listing");
const Review = require("../models/review");
const { notifyUser } = require("../utils/notify.js");


module.exports.createReview = async(req,res) => {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    listing.reviews.push(newReview);
    console.log(newReview);
    await newReview.save();
    await listing.save();

    // Notify the room owner about the new review
    await notifyUser({
        recipient: listing.owner,
        actor: req.user._id,
        type: 'new_review',
        title: 'New Review',
        message: `${req.user.username} left a ${newReview.rating}-star review on "${listing.title}".`,
        link: `/listings/${listing._id}`,
    });

    req.flash("success","New Review created");

    res.redirect(`/listings/${listing._id}`);
};

module.exports.destroyReview = async (req,res) => {
    let {id,reviewId} = req.params;
    await Listing.findByIdAndUpdate(id,{$pull: {reviews:reviewId}});
    await Review.findByIdAndDelete(reviewId);
    req.flash("success","Review Deleted!");

    res.redirect(`/listings/${id}`);
};