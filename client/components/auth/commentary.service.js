'use strict';

angular.module('playolaApp')
  .factory('Commentary', function ($resource) {
    return $resource('/api/v1/commentaries/:id/:controller', {
      id: '@_id'
    },
    {
      get: {
        method: 'GET',
        params: {
          id:'me'
        }
      },
      upload: {
        method: 'POST',
        params: {
          controller: 'upload'
        }
      }
    });
  });