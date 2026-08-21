const Joi = require('joi');

module.exports.listingSchema = Joi.object({
    listing : Joi.object({
        title : Joi.string().required(),
        description : Joi.string().required(),
        location : Joi.string().required(),
        country : Joi.string().required(),
        price : Joi.number().required().min(0),
        bookingPayment: Joi.string().valid('full', 'advance', 'flexible', 'none').optional(),
        minimumAdvance: Joi.number().min(0).allow('', null).optional(),
        // Phase 11 — Advanced Search & Smart Filters (all optional, backward compatible)
        city : Joi.string().allow('', null).optional(),
        roomType : Joi.string().valid('Single Room', 'Shared Room', 'PG', '1RK', '1BHK', '2BHK').allow('', null).optional(),
        furnishing : Joi.string().valid('Fully Furnished', 'Semi Furnished', 'Unfurnished').allow('', null).optional(),
        genderPreference : Joi.string().valid('Boys', 'Girls', 'Anyone').allow('', null).optional(),
        availability : Joi.string().valid('Available', 'Occupied', 'Reserved').allow('', null).optional(),
        minimumStay : Joi.number().integer().min(1).max(36).allow('', null).optional(),
        amenities : Joi.array().items(Joi.string()).allow('', null).optional(),
    }).required() 
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating : Joi.number().required().min(1).max(5),
        comment : Joi.string().required(),
    }).required()
});

module.exports.visitRequestSchema = Joi.object({
    visitRequest: Joi.object({
        date: Joi.date().iso().required().messages({
            'date.format': 'Please provide a valid date.',
            'any.required': 'Visit date is required.',
        }),
        time: Joi.string().required().messages({
            'any.required': 'Visit time is required.',
        }),
        message: Joi.string().allow('').optional().max(500),
    }).required(),
});

module.exports.messSchema = Joi.object({
    mess: Joi.object({
        name : Joi.string().required().max(100),
        description : Joi.string().allow('', null).max(2000),
        monthlyPrice : Joi.number().required().min(0),
        bookingPayment: Joi.string().valid('full', 'advance', 'flexible', 'none').optional(),
        minimumAdvance: Joi.number().min(0).allow('', null).optional(),
        mealType : Joi.string().valid('Veg', 'Non-Veg', 'Both').allow('', null),
        breakfast : Joi.boolean().truthy('on', 'true').falsy('', 'false').allow('', null),
        lunch : Joi.boolean().truthy('on', 'true').falsy('', 'false').allow('', null),
        dinner : Joi.boolean().truthy('on', 'true').falsy('', 'false').allow('', null),
        timing : Joi.string().allow('', null).max(200),
        address : Joi.string().allow('', null).max(300),
        city : Joi.string().allow('', null).max(100),
        location : Joi.string().allow('', null).max(200),
        mapLocation : Joi.string().allow('', null).max(500),
        contactNumber : Joi.string().allow('', null).max(30),
        availability : Joi.string().valid('Available', 'Closed').allow('', null),
    }).required()
});

module.exports.laundrySchema = Joi.object({
    laundry: Joi.object({
        name : Joi.string().required().max(100),
        description : Joi.string().allow('', null).max(2000),
        washFoldPrice : Joi.number().required().min(0),
        bookingPayment: Joi.string().valid('full', 'advance', 'flexible', 'none').optional(),
        minimumAdvance: Joi.number().min(0).allow('', null).optional(),
        ironPrice : Joi.number().allow('', null).min(0),
        dryCleaningPrice : Joi.number().allow('', null).min(0),
        pickupAvailable : Joi.boolean().truthy('on', 'true').falsy('', 'false').allow('', null),
        deliveryAvailable : Joi.boolean().truthy('on', 'true').falsy('', 'false').allow('', null),
        sameDayService : Joi.boolean().truthy('on', 'true').falsy('', 'false').allow('', null),
        workingHours : Joi.string().allow('', null).max(200),
        address : Joi.string().allow('', null).max(300),
        city : Joi.string().allow('', null).max(100),
        location : Joi.string().allow('', null).max(200),
        mapLocation : Joi.string().allow('', null).max(500),
        contactNumber : Joi.string().allow('', null).max(30),
        availability : Joi.string().valid('Available', 'Closed').allow('', null),
    }).required()
});

module.exports.vehicleSchema = Joi.object({
    vehicle: Joi.object({
        name : Joi.string().required().max(100),
        description : Joi.string().allow('', null).max(2000),
        vehicleType : Joi.string().valid('Car', 'Bike', 'Scooter').allow('', null),
        brand : Joi.string().allow('', null).max(100),
        model : Joi.string().allow('', null).max(100),
        dailyPrice : Joi.number().required().min(0),
        bookingPayment: Joi.string().valid('full', 'advance', 'flexible', 'none').optional(),
        minimumAdvance: Joi.number().min(0).allow('', null).optional(),
        weeklyPrice : Joi.number().allow('', null).min(0),
        monthlyPrice : Joi.number().allow('', null).min(0),
        fuelType : Joi.string().valid('Petrol', 'Diesel', 'Electric', 'CNG').allow('', null),
        seats : Joi.number().integer().allow('', null).min(1).max(20),
        gearType : Joi.string().valid('Manual', 'Automatic').allow('', null),
        mileage : Joi.string().allow('', null).max(100),
        availability : Joi.string().valid('Available', 'Rented', 'Maintenance').allow('', null),
        address : Joi.string().allow('', null).max(300),
        city : Joi.string().allow('', null).max(100),
        location : Joi.string().allow('', null).max(200),
        mapLocation : Joi.string().allow('', null).max(500),
        contactNumber : Joi.string().allow('', null).max(30),
    }).required()
});
