var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

exports.setup = function (User, config) {
  passport.use(new LocalStrategy({
      usernameField: 'twitterHandle',
      passwordField: 'password' // this is the virtual field on the model
    },
    function(twitterHandle, password, done) {
      User.findOne({
        twitterHandle:  { $regex: new RegExp("^" + twitterHandle.toLowerCase(), "i") }
      }, function(err, user) {
        if (err) return done(err);

        if (!user) {
          return done(null, false, { message: 'This twitter username is not registered.' });
        }
        if (!user.authenticate(password)) {
          return done(null, false, { message: 'This password is not correct.' });
        }
        return done(null, user);
      });
    }
  ));
};