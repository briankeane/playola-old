'use strict';

angular.module('playolaApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('songManager', {
        url: '/station/songManager',
        templateUrl: 'app/station/songManager/songManager.html',
        controller: 'SongManagerCtrl',
        authenticate: true
      })

      .state('mySchedule', {
        url:'/station/mySchedule',
        templateUrl: 'app/station/mySchedule/mySchedule.html',
        controller: 'myScheduleCtrl',
        authenticate: true
      })

      .state('songMarkup', {
        url: '/station/songMarkup',
        templateUrl: 'app/station/songMarkup/songMarkup.html',
        controller: 'SongMarkupCtrl',
        authenticat: true
      });
  });