'use strict';

angular.module('pl2NodeYoApp')
  .factory('ListeningSession', function ($resource) {
    return $resource('/api/v1/listeningSessions/:id/:controller', {
      id: '@_id'
    },
    {
      get: {
        method: 'GET',
        params: {
          id:'me'
        }
      },
      update: {
        method: 'PUT'
      },
      create: {
        method: 'POST'
      }
    });
  });