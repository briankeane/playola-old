angular.module('playolaApp')
  .controller('AudioRecorderCtrl', function ($scope, $location, Auth, $sce, FileUploader, AudioPlayer) {

    $scope.refreshProgramFromServer;      // filled with reference when needed
    
    $scope.stopDisabled = true;
    $scope.recordButtonDisabled = false;
    $scope.recordedCommentaryObject;
    $scope.recordings = [];
    $scope.blobs = [];
    $scope.recordingCounter = 0;
    $scope.wasMuted;



    // **************************************************************************
    // *                  set up FileUploader for Commentaries                  *
    // ************************************************************************** 
    $scope.FileUploader = FileUploader;
    $scope.uploader = new FileUploader({ url: 'api/v1/commentaries/upload',
                                          autoUpload: true });

    // replace file with blob before upload
    $scope.uploader.onBeforeUploadItem = function(item) {
        console.info('onBeforeUploadItem', item);
        item._file = $scope.blobs[0].blob;
        
        // add formData necessary for processing
        item.formData.push({ duration: Math.round($scope.mostRecentCommentary.model.duration),
                            _station: Auth.getCurrentStation()._id,
                            playlistPosition: $scope.mostRecentCommentary.playlistPosition });
    };

    // refresh the program after uploading
    $scope.uploader.onCompleteItem = function (item) {
      $scope.refreshProgramFromServer();
    };
    
    // **************************************************************************
    // *                    audioRecording sortable list                        *
    // **************************************************************************
    $scope.audioRecordingList = {
      connectWith: '.stationList',

      remove: function (event, ui) {
        ui.item.sortable.model._type = 'Commentary';
      },
      removed: function (event) {
        var commentary = new $scope.FileUploader.FileLikeObject(event.source.nodeScope.$modelValue.blob);
        commentary.lastModifiedDate = new Date();
        var targetPlaylistPosition = event.dest.nodesScope.$modelValue[event.dest.index + 1].playlistPosition;
        $scope.mostRecentCommentary = { fileLikeObject: commentary,
                                        model: event.source.nodeScope.$modelValue,
                                        playlistPosition: targetPlaylistPosition };
        $scope.uploader.addToQueue([commentary]);
        $scope.refreshProgramFromServer = event.dest.nodesScope.refreshProgramFromServer;
        $scope.recordButtonDisabled = false;
      }
    }

    // ****************************************************************************
    // *                            Recording...                                  *
    // ****************************************************************************
    $scope.startRecordingPressed = function () {
      startRecording();
      $scope.recordButtonDisabled = true;
      $scope.stopDisabled = false;
      if (AudioPlayer.muted) {
        wasMuted = true;
      } else {
        AudioPlayer.mute();
        wasMuted = false;
      }
      $(document).trigger('recordingStarted');
    };

    $scope.stopRecordingPressed = function () {
      stopRecording();
      $(document).trigger('recordingStopped');
      $scope.stopDisabled = true;
      $scope.recordButtonDisabled = true;
      if (!wasMuted) {
        AudioPlayer.unmute();
      }
    };

    var audio_context;
    var recorder;
    var recordButton = $('#startRecording');
    var stopButton = $('#stopRecording');
    var volumeMeter = $('#volumeMeter');
    var canvas = document.getElementById("volumeMeter");
    var ctx = canvas.getContext("2d");
    // debugger;
    console.log(ctx);


    function startUserMedia(stream) {
      var input = audio_context.createMediaStreamSource(stream);
      console.log('Media stream created.');

      // set up nodes
      volumeAnimateNode = audio_context.createScriptProcessor(2048, 1, 1);
      volumeAnimateNode.connect(audio_context.destination);
      volumeAnalyser = audio_context.createAnalyser();
      volumeAnalyser.smoothingTimeConstant = 0/3;
      volumeAnalyser.fftSize = 2048;

      input.connect(volumeAnalyser);
      volumeAnalyser.connect(volumeAnimateNode);



    // THE FOLLOWING 2 WERE GRABBED FROM: http://css.dzone.com/articles/exploring-html5-web-audio
      var bufferLength = volumeAnalyser.fftSize;
      var dataArray = new Uint8Array(bufferLength);

      ctx.clearRect(0,0, canvas.width, canvas.height);

      function draw() {
        var drawVisual = requestAnimationFrame(draw);
        volumeAnalyser.getByteTimeDomainData(dataArray);
        ctx.fillStyle = 'rgb(1000,1000,1000)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgb(0,0,0)';
        ctx.beginPath();

        var sliceWidth = canvas.width * 1.0/bufferLength;
        var x = 0;

        for (var i=0; i<bufferLength; i++) {
          var v=dataArray[i]/128.0;
          var y = v*canvas.height/2;

          if (i===0) {
            ctx.moveTo(x,y);
          } else {
            ctx.lineTo(x,y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height/2);
        ctx.stroke();

      }

      draw();

      recorder = new Recorder(input);
      console.log('Recorder initialised.');
    }

    function startRecording(button) {
      // recorder
      recorder && recorder.record();
      console.log('Recording...');
    }

    function stopRecording(button) {
      recorder && recorder.stop();
      console.log('Stopped recording.');

      // create WAV download link using audio data blob
      createDownloadLink();
      recorder.clear();
    }

    function createDownloadLink() {
      recorder && recorder.exportWAV(function(blob) {
        var url = URL.createObjectURL(blob);
        var li = $('#recording li');
        var au = document.createElement('audio');
        var hf = document.createElement('a');
        var recordingList = $('#recordings');
        var template = $('#recording li').html();

        // store the blob and it's info
        au.onloadeddata = function () {
          $scope.recordings.push({  _audioBlock: { 
                                      _type: 'Commentary',
                                      audioFileUrl: url, 
                                      duration: au.duration * 1000,
                                      airtime: null,
                                      title: 'Commentary'
                                    },
                                  _id: $scope.recordingCounter++,
                                  blob: blob,
                                  url: $sce.trustAsResourceUrl(url),
                                  src: $sce.trustAsResourceUrl(au.src),
                                  duration: au.duration * 1000 });
          $scope.blobs.push({ _type: 'Commentary',
                                              blob: blob,
                                              url: $sce.trustAsResourceUrl(url),
                                              src: $sce.trustAsResourceUrl(au.src),
                                              duration: au.duration * 1000 });
          console.log($scope.recordings);
        }

        // add the element to the screen
        au.controls = true;
        au.src = url;
        hf.href = url;
      });
    }

    try {
      // webkit shim
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      navigator.getUserMedia = navigator.getUserMedia || 
                              navigator.webkitGetUserMedia ||
                              navigator.mozGetUserMedia ||
                              navigator.msGetUserMedia;
      window.URL = window.URL || window.webkitURL;

      audio_context = new AudioContext;
      console.log('Audio context set up.');
      console.log('navigator.getUserMedia ' + (navigator.getUserMedia ? 'available.' : 'not present!'));
    } catch (e) {
      alert('No web audio support in this browser! ' + e);
    }

    navigator.getUserMedia({audio: true}, function(stream) {

      console.log("This is running");
      startUserMedia(stream);

    }, function(e) {
      $scope.recordingEnabled = false;
      console.log('No live audio input: ' + e);
    });
  });