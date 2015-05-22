angular.module('playolaApp')
  .controller('uploaderCtrl', function ($scope, Auth, FileUploader, $modal) {
    $scope.uploader = new FileUploader({ url: 'http://upload.playola.fm/uploads',
                                        // headers: { 'Access-Control-Allow-Origin': '*' },
                                          //withCredentials: true,
                                          autoUpload: true });

      // $scope.uploader.onWhenAddingFileFailed = function(item /*{File|FileLikeObject}*/, filter, options) {
      //     console.info('onWhenAddingFileFailed', item, filter, options);
      // };
      // $scope.uploader.onAfterAddingFile = function(fileItem) {
      //     console.info('onAfterAddingFile', fileItem);
      // };
      // $scope.uploader.onAfterAddingAll = function(addedFileItems) {
      //     console.info('onAfterAddingAll', addedFileItems);
      // };
      $scope.uploader.onBeforeUploadItem = function(item) {
          // set status to 'Uploading'
          item.status = 'Uploading';
      };
      $scope.uploader.onProgressItem = function(fileItem, progress) {
          // switch status to processing after upload is complete
          if (progress === 100) {
            fileItem.status = 'Processing';
          }
      };
      // $scope.uploader.onProgressAll = function(progress) {
      //     console.info('onProgressAll', progress);
      // };
      // $scope.uploader.onSuccessItem = function(fileItem, response, status, headers) {
      //     console.info('onSuccessItem', fileItem, response, status, headers);
      // };
      // $scope.uploader.onErrorItem = function(fileItem, response, status, headers) {
      //     console.info('onErrorItem', fileItem, response, status, headers);
      // };
      // $scope.uploader.onCancelItem = function(fileItem, response, status, headers) {
      //     console.info('onCancelItem', fileItem, response, status, headers);
      // };

      $scope.uploader.onCompleteItem = function(fileItem, response, status, headers) {
        if (response.status === 'More Info Needed') {
          fileItem.status = response.status;
          fileItem.uploadItem = response.upload
          fileItem.uploadId = response.upload._id;
        } else if (response.status === 'Song Already Exists') {
          fileItem.status = 'Success';
          fileItem.songId = response.song._id;
        } else if (response.status === 'added') {
          fileItem.status = 'Success';
          fileItem.songId = response.song._id;
        }

      };
      $scope.uploader.onCompleteAll = function() {
          console.info('onCompleteAll');
      };

      $scope.addToMyStation = function (songId) {
        Auth.createRotationItem({ weight: 17,
                                  bin: 'active',
                                  _song: songId }, function (err, results) {
          if (!err){
            for (var i=0;i<$scope.uploader.queue.length;i++) {
              if ($scope.uploader.queue[i].songId === songId) {
                $scope.uploader.queue[i].addedToStation = true;

              }
            }
          }
        });
      };

      $scope.getSongMatch = function (item) {
        $modal.open({
          templateUrl: 'components/uploader/getMatch.modal.html',
          size: 'lg',
          scope: $scope,  
          controller: function ($modalInstance) {

            $scope.item = item;
            $scope.selectedSong = {}
            $scope.selectedSong.index = '';
            $scope.oldTitle = item.uploadItem.tags.title;
            $scope.oldAlbum = item.uploadItem.tags.album;
            $scope.oldArtist = item.uploadItem.tags.artist;
            $scope.tagsChanged = false;
            $scope.tags = item.uploadItem.tags;

            $scope.cancel = function () {
              $modalInstance.dismiss('cancel');
            };

            $scope.setValue = function () {
              $scope.selectedSong.index = 'ECHONESTIDNOTFOUND';
            }

            $scope.submitForm = function () {
              $scope.submitted = true;
              
              // IF it was not found, resubmit request...
              if ($scope.selectedSong.index === 'ECHONESTIDNOTFOUND') {
                $modalInstance.dismiss('close');
                // see if new tags are needed
                $modal.open({
                  templateUrl: 'components/uploader/getTags.modal.html',
                  size: 'med',
                  scope: $scope,
                  controller: function ($modalInstance) {
                    $scope.cancel = function () {
                      $modalInstance.dismiss('cancel');
                    };

                    $scope.submitTagForm = function () {
                      if ($scope.tagsChanged) {
                        var uploadInfo = { uploadId: item.uploadItem._id,
                                            tags: $scope.tags }
                        Auth.submitUploadWithNewTags(uploadInfo, function (err, response) {

                        })
                      
                      // ELSE tags have not changed
                      } else {
                        // add without echonestId
                        Auth.submitUploadWithoutEchonestId
                      }
                    }

                  }
                })





                if ($scope.tagsChanged) {
                  var uploadInfo = { uploadId: item.upload._id,
                                     tags: item.tags }
                  Auth.submitUploadWithoutEchonestId(uploadInfo, function (err, response) {
                    if (err) {

                    } else {
                      if (response.status === 'Song Added') {
                        item.isNeedInfo = false;
                        item.status = response.status
                        item.isSuccess = true;
                        item.songId = response.song._id;
                        $modalInstance.dismiss('close');
                      }
                    }
                  });
                }
              // if echonestID was provided, resubmit upload
              }  else {
                var index = parseInt($scope.selectedSong.index);
                var uploadInfo = { artist: item.uploadItem.possibleMatches[index].artist,
                                    title: item.uploadItem.possibleMatches[index].title,
                                    echonestId: item.uploadItem.possibleMatches[index].echonestId,
                                    album: item.uploadItem.possibleMatches[index].album || item.uploadItem.album,
                                    uploadId: item.uploadItem._id,
                                    tags: item.uploadItem.tags
                                  };
                Auth.submitUploadViaEchonestId(uploadInfo, function (err, response) {
                  if (response.status === 'Song Already Exists' || 'Song Added') {
                    item.isNeedInfo = false;
                    item.status = response.status;
                    item.isSuccess = true;
                    item.songId = response.song._id;
                    $modalInstance.dismiss('close');
                  }
                });

              }
            };

          }
        }).result.then(function () {
          if ($scope.selectedSong.index === 'ECHONESTIDNOTFOUND') {
            if ($scope.tagsChanged) {
              var uploadInfo = { uploadId: item.uploadId,
                                 tags: item.tags
                                };
              
              Auth.resubmitUploadWithUpdatedTags(uploadInfo, function (err, response) {
                if (response.status === 'info needed') {
                  item.status = response.status;
                  item.possibleMatches = response.possibleMatches;
                  item.tags = response.tags;
                  item.filename = response.filename;
                  item.isSuccess = false;
                  item.isNeedInfo = true;
                  item.uploadId = response._id;
                } else if (response.status === 'Song Already Exists') {
                  item.isNeedInfo = false;
                  item.status = response.status;
                  item.isSuccess = true;
                  item.songId = response.song._id;

                } else if (response.status === 'added') {
                  item.isNeedInfo = false;
                  item.status = response.status;
                  item.isSuccess = true;
                  item.songId = response.song._id;
                }
              });
            }
          }

        });
      };
  });