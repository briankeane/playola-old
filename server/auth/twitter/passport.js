exports.setup = function (User, config) {
  var passport = require('passport');
  var TwitterStrategy = require('passport-twitter').Strategy;
  var request = require('request');

  passport.use(new TwitterStrategy({
    consumerKey: config.twitter.clientID,
    consumerSecret: config.twitter.clientSecret,
    callbackURL: config.twitter.callbackURL
  },

  function(token, tokenSecret, profile, done) {
    User.findOne({
      'twitter.id_str': profile.id
    }, function(err, user) {
      if (err) {
        return done(err);
      }
      if (!user) {
        getFriends(token, tokenSecret, profile, function (err, friends) {
          user = new User({
            twitterHandle: profile.username,
            twitterUID: profile.id,
            name: profile.name,
            role: 'user',
            provider: 'twitter',
            twitter: profile._json,
          });
          user.twitter.friends = friends
          user.save(function(err) {
            if (err) return done(err);
            return done(err, user);
          });
        });
      } else {
        getFriends(token, tokenSecret, profile, function (err, friends) {
          user.twitter.friends = friends;
          user.save(function (err) {
            return done(err, user);
          });
        });
      }
    });


    function getFriends (token, tokenSecret, profile, callback) {
      var friends = [];
      var totalFriends = profile._json.friends_count;

      // -- GET FRIENDS -- //
      var oauth = {
        consumer_key: config.twitter.clientID,
        consumer_secret: config.twitter.clientSecret,
        token: token,
        token_secret: tokenSecret
      }

      getSetOfFriends(-1);

      function getSetOfFriends(cursor) {
        var url = 'https://api.twitter.com/1.1/friends/list.json?count=200&user_id=' + profile.id +
                                                                    '&cursor=' + cursor;


        request.get({url:url, oauth:oauth, json:true}, function (err, r, result) {

          friends = friends.concat(result.users);
          
          // continue making requests if necessary
          if (result.next_cursor !== 0) {
            getSetOfFriends(result.next_cursor);
          }

          // if this was the last response to come in, update the user
          if (friends.length === totalFriends) {
            callback(null, friends);
          }
        });
      }
    }

    }
  ));
};