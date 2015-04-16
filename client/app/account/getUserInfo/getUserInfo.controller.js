'use strict';

angular.module('playolaApp')
  .controller('GetUserInfoCtrl', function ($scope, Auth, $location, $window) {
    $scope.user = Auth.getCurrentUser();
    $scope.errors = {};
    $scope.artist1 = '';

    $scope.updateInitialUserInfo = function(form) {
      $scope.submitted = true;

      // remove notFound error
      form["zipcode"].$setValidity('notFound', true);
      

      if(form.$valid) {
        
        Auth.updateUser({
          birthYear: $scope.user.birthYear,
          gender: $scope.user.gender
        })
        .then( function() {
          Auth.setZipcode($scope.user.zipcode, function(err, zipcode) {
            if (err) {
              var error = err.data;
              form["zipcode"].$setValidity('notFound', false);
              $scope.errors["zipcode"] = error.message;
            }
          });
        })
        .catch( function(err) {
          err = err.data;
          $scope.errors = {};

          // Update validity of form fields that match the mongoose errors
          angular.forEach(err.errors, function(error, field) {
            form[field].$setValidity('mongoose', false);
            $scope.errors[field] = error.message;
          });
        });
      }
    };

    $scope.loginOauth = function(provider) {
      $window.location.href = '/auth/' + provider;
    };
  });
