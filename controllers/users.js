const User = require("../models/user");

module.exports.renderSignupForm = (req,res) => {
    res.render("users/signup.ejs");
};

module.exports.signUp = async (req,res) => {
    try{
     const { username, email, password, role, phone, whatsapp } = req.body;

    const newUser = new User({ email, username, role: role || 'student', phone: phone || '', whatsapp: whatsapp || '' });
    const registeredUser = await User.register(newUser, password);

    console.log(registeredUser);

    req.login(registeredUser,(err)  => {
        if(err){
            return next(err);
        }
        req.flash("success", "Welcome to Student Accommodation!");
    res.redirect("/listings");
    })
    }catch(e){
        req.flash("error",e.message);
        res.redirect("/signup");
    }
};

module.exports.renderLoginForm = async(req,res) => {
    res.render("users/login.ejs");
};

module.exports.login = async(req,res) => {
        req.flash("success", "Welcome back to Student Accommodation!");
        let redirectUrl = res.locals.redirectUrl || "/listings";
        res.redirect(redirectUrl);
};

module.exports.renderAboutPage = (req, res) => {
    res.render("about/about.ejs");
};

module.exports.logout = (req,res,next) => {
    req.logout((err) => {
        if(err) {
           return next(err);
        }
        req.flash("success","you are logged out!");
        res.redirect("/listings");
    })
};
