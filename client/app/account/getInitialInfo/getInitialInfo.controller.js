angular.module('playolaApp')
  .controller('GetInitialInfoCtrl', function ($scope, Auth, $modal, $location) {

    var user = Auth.getCurrentUser();
    
    // IF so that mobile won't display if manually directed to page
    if (!(user.zipcode && user.birthYear && user.gender && user._station)) {
      $modal.open({
        templateUrl: 'app/account/getInitialInfo/getInitialInfo.modal.html',
        height: 'auto',
        backdrop: 'static',
        controller: function ($scope, $modalInstance) {
          $scope.user = Auth.getCurrentUser();
          $scope.errors = {};
          $scope.artist1='';

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
                })
                .then( function () {
                  
                  // create array from inputs
                  var artists = []
                  if (form.artist1.$modelValue) { artists.push(form.artist1.$modelValue); }
                  if (form.artist2.$modelValue) { artists.push(form.artist2.$modelValue); }
                  if (form.artist3.$modelValue) { artists.push(form.artist3.$modelValue); }
                  if (form.artist4.$modelValue) { artists.push(form.artist4.$modelValue); }
                  if (form.artist5.$modelValue) { artists.push(form.artist5.$modelValue); }

                  // All updated, redirect home
                  // $location.path('/');
                  Auth.createStation({ _user: $scope.user._id,
                                       artists: artists }, function (err, newStation) {
                    $scope.station = newStation;
                    $location.path('/station');
                    $modalInstance.dismiss();

                  });
                })
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
        } // END controller
     });  // END modal
    } // ENDIF
  })