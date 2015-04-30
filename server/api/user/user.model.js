'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crypto = require('crypto');
var authTypes = ['twitter'];
var timestamps = require('mongoose-timestamp');

var UserSchema = new Schema({
  twitterHandle:          { type: String },
  twitterUID:             { type: String },
  email:                  { type: String },
  birthYear:              { type: Number },
  gender:                 { type: String },
  zipcode:                { type: String },
  timezone:               { type: String }, 
  _station:               { type: Schema.ObjectId, ref: 'Station' },
  name:                   { type: String },
  role:                   { type: String, default: 'user'},
  hashedPassword:         { type: String },
  provider:               { type: String },
  salt:                   { type: String },
  lastCommercial:         {},
  twitter:                {},
  tours:                  {} 
}, {
  toObject: { getters: true },
  toJSON: { virtuals: true }
});

/**
 * Virtuals
 */
UserSchema
  .virtual('password')
  .set(function(password) {
    this._password = password;
    this.salt = this.makeSalt();
    this.hashedPassword = this.encryptPassword(password);
  })
  .get(function() {
    return this._password;
  });

UserSchema
  .virtual('profileImageUrl')
  .get(function() {
    if (this.twitter && this.twitter.profile_image_url) {
      return this.twitter.profile_image_url.replace('_normal', '');
    } else {
      return null;
    }
  })

UserSchema
  .virtual('profileImageUrlSmall')
  .get(function() {
    if (this.twitter) {
      return this.twitter.profileImageUrl;
    } else {
      return null;
    }
  })

// Public profile information
UserSchema
  .virtual('profile')
  .get(function() {
    return {
      'name': this.name,
      'role': this.role
    };
  });

// Non-sensitive info we'll be putting in the token
UserSchema
  .virtual('token')
  .get(function() {
    return {
      '_id': this._id,
      'role': this.role
    };
  });

/**
 * Validations
 */

//Validate empty birthYear
UserSchema
  .path('birthYear')
  .validate(function(birthYear) {
    if (authTypes.indexOf(this.provider) !== -1) return true;
    return birthYear.length;
  }, 'Birthyear cannot be blank');

// // Validate empty gender
// UserSchema
//   .path('gender')
//   .validate(function(gender) {
//     if (authTypes.indexOf(this.provider) !== -1) return true;
//     return gender.length;
//   }, 'Gender cannot be blank');

// // Validate empty zipcode
// UserSchema
//   .path('zipcode')
//   .validate(function(zipcode) {
//     if (authTypes.indexOf(this.provider) !== -1) return true;
//     return zipcode.length;
//   }, 'Zipcode cannot be blank');

// // Validate twitterHandle is not taken
// UserSchema
//   .path('twitterHandle')
//   .validate(function(value, respond) {
//     var self = this;
//     this.constructor.findOne({twitterHandle: value}, function(err, user) {
//       if(err) throw err;
//       if(user) {
//         if(self.id === user.id) return respond(true);
//         return respond(false);
//       }
//       respond(true);
//     });
// }, 'The specified twitter Handle is already in use.');

var validatePresenceOf = function(value) {
  return value && value.length;
};

/**
 * Pre-save hook
 */
// UserSchema
//   .pre('save', function(next) {
//     if (!this.isNew) return next();

//     if (!validatePresenceOf(this.hashedPassword) && authTypes.indexOf(this.provider) === -1)
//       next(new Error('Invalid password'));
//     else
//       next();
//   });

/**
 * Methods
 */
UserSchema.methods = {
  /**
   * Authenticate - check if the passwords are the same
   *
   * @param {String} plainText
   * @return {Boolean}
   * @api public
   */
  authenticate: function(plainText) {
    return this.encryptPassword(plainText) === this.hashedPassword;
  },

  /**
   * Make salt
   *
   * @return {String}
   * @api public
   */
  makeSalt: function() {
    return crypto.randomBytes(16).toString('base64');
  },

  /**
   * Encrypt password
   *
   * @param {String} password
   * @return {String}
   * @api public
   */
  encryptPassword: function(password) {
    if (!password || !this.salt) return '';
    var salt = new Buffer(this.salt, 'base64');
    return crypto.pbkdf2Sync(password, salt, 10000, 64).toString('base64');
  }
};

UserSchema.statics.keywordSearch = function (keywords, cb) {
  // create an array of regex's
  var keywordsArray = keywords.split(' ');
  var keywordsRegexs = [];
  for (var i=0; i<keywordsArray.length; i++) {
    keywordsRegexs.push(new RegExp(keywordsArray[i], "i"));
  }

  // build the query
  var query = { $and: [] };
  for (var i=0; i<keywordsRegexs.length; i++) {
    query['$and'].push({ $or: [{ twitterHandle: keywordsRegexs[i] }, { name: keywordsRegexs[i] }] });
  }

User
  .find(query)
  .sort('twitterHandle')
  .limit(20)
  .populate('_station')
  .exec(cb);
}

UserSchema.plugin(timestamps);
var User = mongoose.model('User', UserSchema);
module.exports = User;
