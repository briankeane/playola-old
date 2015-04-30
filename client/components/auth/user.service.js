'use strict';

angular.module('playolaApp')
  .factory('User', function ($resource) {
    return $resource('/api/v1/users/:id/:controller', {
      id: '@_id'
    },
    {
      changePassword: {
        method: 'PUT',
        params: {
          controller:'password'
        }
      },
      update: {
        method: 'PUT',
        params: {
          controller:'update'
        }
      },
      reportTourTaken: {
        method: 'PUT',
        params: {
          controller: 'reportTourTaken'
        }
      },
      get: {
        method: 'GET',
        params: {
          id:'me'
        }
      },
      setZipcode: {
        method: 'PUT',
        params: {
          controller: 'setZipcode'
        }
      },
      getTwitterFriends: {
        method: 'GET',
        params: {
          controller: 'twitterFriends',
          _id: '@_id'
        }
      },
      findByKeywords: {
        method: 'GET',
        params: {
          controller: 'findByKeywords'
        }
      },
      getPresets: {
        method: 'GET',
        params: {
          controller: 'presets',
          _id: '@_id'
        }
      },
      follow: {
        method: 'PUT',
        params: {
          controller: 'follow'
        }
      },
      unfollow: {
        method: 'PUT',
        params: {
          controller: 'unfollow'
        }
      }
	  });
  });
