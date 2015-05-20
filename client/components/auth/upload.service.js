'use strict';

angular.module('playolaApp')
  .factory('Upload', function ($resource) {
    return $resource('/api/v1/uploads/:id/:controller', {
      id: '@_id'
    },
    {
      get: {
        method: 'GET',
        params: {
          id:'me'
        }
      },
      submitViaEchonestId: {
        method: 'PUT',
        params: {
          controller: 'submitViaEchonestId'
        }
      },
      submitWithNewTags: {
        method: 'PUT',
        params: {
          controller: 'submitWithNewTags'
        }
      },
      submitWithoutEchonestId: {
        method: 'PUT',
        params: {
          controller: 'submitWithoutEchonestId'
        }
      }
    });
  });