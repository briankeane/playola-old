'use strict';

angular.module('playolaApp')
  .factory('Auth', function Auth($location, $rootScope, $http, User, RotationItem, Station, Upload, Song, Spin, ListeningSession, $cookieStore, $q) {
    var currentUser;
    var currentStation;

    if($cookieStore.get('token')) {
      currentUser = User.get();
      currentStation = Station.get();
    }

    return {

      /**
       * Authenticate user and save token
       *
       * @param  {Object}   user     - login info
       * @param  {Function} callback - optional
       * @return {Promise}
       */
      login: function(user, callback) {
        var cb = callback || angular.noop;
        var deferred = $q.defer();

        $http.post('/auth/local', {
          email: user.email,
          password: user.password
        }).
        success(function(data) {
          $cookieStore.put('token', data.token);
          currentUser = User.get();
          deferred.resolve(data);
          $rootScope.$broadcast('loggedIn');
          return cb();
        }).
        error(function(err) {
          this.logout();
          deferred.reject(err);
          return cb(err);
        }.bind(this));

        return deferred.promise;
      },

      /**
       * Delete access token and user info
       *
       * @param  {Function}
       */
      logout: function() {
        $cookieStore.remove('token');
        currentUser = {};
        $rootScope.$broadcast('loggedOut');
      },

      /**
       * Create a new user
       *
       * @param  {Object}   user     - user info
       * @param  {Function} callback - optional
       * @return {Promise}
       */
      createUser: function(user, callback) {
        var cb = callback || angular.noop;

        return User.save(user,
          function(data) {
            $cookieStore.put('token', data.token);
            currentUser = User.get();
            return cb(user);
          },
          function(err) {
            this.logout();
            return cb(err);
          }.bind(this)).$promise;
      },

      /**
       * Change password
       *
       * @param  {String}   oldPassword
       * @param  {String}   newPassword
       * @param  {Function} callback    - optional
       * @return {Promise}
       */
      changePassword: function(oldPassword, newPassword, callback) {
        var cb = callback || angular.noop;

        return User.changePassword({ id: currentUser._id }, {
          oldPassword: oldPassword,
          newPassword: newPassword
        }, function(user) {
          return cb(user);
        }, function(err) {
          return cb(err);
        }).$promise;
      },

      /**
       * Update User
       *
       * @param  {}       updatesObject
       * @param  {Function} callback    - optional
       * @return {Promise}
       */
      updateUser: function (updatesObject, callback) { 
        var cb = callback || angular.noop;

        return User.update({ id: currentUser._id }, updatesObject, function (user) {
          return cb(user);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      /**
      * Set User Zipcode
      *
      * @param  String     newZipcode
      * @param  {Function} callback    - optional
      * @return {Promise}
      *
      * Looks up timezone and sets it and zipcode for the user
      *
      * @return {Object} user
      */
      setZipcode: function(newZipcode, callback) {
        var cb = callback || angular.noop;

        return User.setZipcode({ id: currentUser._id }, { zipcode: newZipcode }, function (user) {
          return cb(null, user);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      follow: function (stationId, callback) {
        var cb = callback || angular.noop;

        return User.follow({ id: currentUser._id }, { stationId: stationId }, function (result) {
          return cb(null, result);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      unfollow: function (stationId, callback) {
        var cb = callback || angular.noop;

        return User.unfollow({ id: currentUser._id }, { stationId: stationId }, function (presets) {
          return cb(null, presets);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      getTwitterFriends: function (callback) {
        var cb = callback || angular.noop;

        return User.getTwitterFriends({},{ _id: currentUser._id },function (result) {
          return cb(null, result);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      getPresets: function (callback) {
        var cb = callback || angular.noop;

        return User.getPresets({ id: currentUser._id }, { }, function (result) {
          return cb(null, result);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      createStation: function (stationObject, callback) {
        var cb = callback || angular.noop;

        return Station.create({ _user: currentUser._id }, stationObject, function (station) {
          currentStation = station;
          currentUser._station = station;
          return cb(null, station);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      createListeningSession: function (attrs, callback) {
        var cb = callback || angular.noop;

        return ListeningSession.create({}, attrs, function (listeningSession) {
          return cb(null, listeningSession);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      updateListeningSession: function (attrs, callback) {
        var cb = callback || angular.noop;

        return ListeningSession.update(attrs, attrs, function (listeningSession) {
          return cb(null, listeningSession);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      getTopStations: function (attrs, callback) {
        var cb = callback || angular.noop;

        return Station.getTopStations({},{}, function (topStations) {
          return cb(null, topStations);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      getCurrentStation: function() {
        return currentStation;
      },

      /**
       * Gets all available info on authenticated user
       *
       * @return {Object} user
       */
      getCurrentUser: function() {
        return currentUser;
      },

      getProgram: function(attrs, callback) {
        var cb = callback || angular.noop;

        if (!attrs.id) {
          attrs.id = currentStation._id;
        }

        return Station.getProgram({ id: attrs.id, _user: currentUser._id }, attrs, function (program) {
          return cb(null, program);
        }, function (err) {
          return cb(err);
        }).$promise;
      },
      
      getRotationItems: function(_station, callback) {
        var cb = callback || angular.noop;

        return Station.getRotationItems({}, { _id: currentStation._id }, function (rotationItems) {
          return cb(null, rotationItems.rotationItems);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      removeRotationItem: function (rotationItemId, callback) {
        var cb = callback || angular.noop;

        return Station.removeRotationItem({ id: currentStation._id }, { rotationItemId: rotationItemId }, function (updatedRotationItems) {
          return cb(null, updatedRotationItems.rotationItems)
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      updateRotationBin: function (rotationItemObject, callback) {
        var cb = callback || angular.noop;

        return Station.updateRotationBin({ id: currentStation._id }, { rotationItemId: rotationItemObject._id, bin: rotationItemObject.bin }, function (updatedRotationItems) {
          return cb(null, updatedRotationItems.rotationItems)
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      updateSong: function (songInfo, callback) {
        var cb = callback || angular.noop;

        return Song.update({ id: songInfo._id }, songInfo, function (updatedSong) {
          return cb(null, updatedSong.updatedSong);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      updateRotationItem: function (rotationItemObject, callback) {
        var cb = callback || angular.noop;

        return RotationItem.update({ id: rotationItemObject._id }, rotationItemObject, function (updatedRotationItem) {
          return cb(null, updatedRotationItem);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      createRotationItem: function (rotationItemObject, callback) {
        var cb = callback || angular.noop;

        rotationItemObject._station = currentStation._id;

        return Station.createRotationItem({ id: currentStation._id }, rotationItemObject, function (updatedRotationItems) {
          return cb(null, updatedRotationItems)
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      moveSpin: function (moveSpinObject, callback) {
        var cb = callback || angular.noop;

        return new Spin.move({ id: moveSpinObject.spinId }, moveSpinObject, function (updatedProgram) {
          return cb(null, updatedProgram);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      removeSpin: function (spin, callback) {
        var cb = callback || angular.noop;

        return new Spin.remove({ id: spin._id }, {}, function (updatedProgram) {
          return cb(null, updatedProgram);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      insertSpin: function (spinInfo, callback) {
        var cb = callback || angular.noop;

        return new Spin.insert({}, spinInfo, function (updatedProgram) {
          return cb(null, updatedProgram);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      resubmitUploadWithEchonestId: function (item, callback) {
        var cb = callback || angular.noop;

        return new Upload.resubmitWithEchonestId(item, { _id: item.uploadId }, function (result) {
          return cb(null, result);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      resubmitUploadWithUpdatedTags: function (item, callback) {
        var cb = callback || angular.noop;

        return new Upload.resubmitWithUpdatedTags(item, { _id: item.uploadId }, function (result) {
          return cb(null, result);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      findSongsByKeywords: function (searchString, callback) {
        var cb = callback || angular.noop;

        return Song.findByKeywords({ searchString: searchString }, { searchString: searchString }, function (results) {
          return cb(null, results.searchResults);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      findUsersByKeywords: function (searchString, callback) {
        var cb = callback || angular.noop;

        return User.findByKeywords({ searchString: searchString }, {searchString: searchString }, function (results) {
          return cb(null, results.searchResults);
        }, function (err) {
          return cb(err);
        }).$promise;
      },

      /**
       * Check if a user is logged in
       *
       * @return {Boolean}
       */
      isLoggedIn: function() {
        return currentUser.hasOwnProperty('role');
      },

      /**
       * Waits for currentUser to resolve before checking if user is logged in
       */
      isLoggedInAsync: function(cb) {
        if(currentUser.hasOwnProperty('$promise')) {
          currentUser.$promise.then(function() {
            cb(true);
          }).catch(function() {
            cb(false);
          });
        } else if(currentUser.hasOwnProperty('role')) {
          cb(true);
        } else {
          cb(false);
        }
      },

      /**
       * Check if a user is an admin
       *
       * @return {Boolean}
       */
      isAdmin: function() {
        return currentUser.role === 'admin';
      },

      /**
       * Get auth token
       */
      getToken: function() {
        return $cookieStore.get('token');
      }
    };
  });
