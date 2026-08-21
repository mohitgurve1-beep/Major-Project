require("dotenv").config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const User = require("./models/user.js");
const Notification = require("./models/notification.js");
const listingsRouter = require("./routes/listing.js");
const reviewsRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const notificationsRouter = require("./routes/notification.js");
const messRouter = require("./routes/mess.js");
const laundryRouter = require("./routes/laundry.js");
const vehicleRouter = require("./routes/vehicle.js");
const paymentRouter = require("./routes/payment.js");
const adminRouter = require("./routes/admin.js");

const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/majorproject";

async function connectDB() {
    await mongoose.connect(dbUrl);
    console.log("MongoDB connected");
}

connectDB().catch((err) => {
    console.error("MongoDB connection error:", err.message);
});

const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 3600,
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

const sessionConfig = {
    store,
    secret: process.env.SECRET || "thisshouldbeabettersecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7,
    },
};

app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.locals.timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return seconds <= 0 ? 'just now' : `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
};

app.use(async (req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    res.locals.unreadNotifications = 0;
    res.locals.latestNotifications = [];

    // Blocked accounts are logged out on their very next request.
    if (req.user && req.user.blocked) {
        req.logout(() => {});
        req.flash("error", "Your account has been blocked by the admin. Please contact support.");
        return res.redirect("/login");
    }

    if (req.user) {
        try {
            const [unreadCount, latestNotifications] = await Promise.all([
                Notification.countDocuments({ recipient: req.user._id, isRead: false }),
                Notification.find({ recipient: req.user._id })
                    .sort({ createdAt: -1 })
                    .limit(5),
            ]);
            res.locals.unreadNotifications = unreadCount;
            res.locals.latestNotifications = latestNotifications;
        } catch (err) {
            console.warn("Failed to load notifications:", err.message);
        }
    }
    next();
});

app.get("/", (req, res) => {
    res.redirect("/listings");
});

app.use("/listings", listingsRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/notifications", notificationsRouter);
app.use("/messes", messRouter);
app.use("/laundry", laundryRouter);
app.use("/vehicles", vehicleRouter);
app.use("/payments", paymentRouter);
app.use("/admin", adminRouter);
app.use("/", userRouter);

app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Something went wrong";
    res.status(statusCode).render("Error.ejs", { message, statusCode, err });
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the existing process or set PORT to another value.`);
        process.exit(1);
    }

    throw err;
});
