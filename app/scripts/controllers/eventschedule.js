angular.module('sdbaApp')
  .controller('EventScheduleCtrl', function($scope, DBService, $location, $rootScope) {

    $scope.eventSettings = {};
    $scope.missing = [];

    $scope.existingErrors = function() {
      if ($scope.missing.length !== 0) {
        return true;
      }

      if ($('.danger').length > 0) {
        return true;
      }

    }

    $scope.save = function() {
      //reassign ids, get rid of
      //validate schedule here (again)
      var errors = DBService.validateSchedule($scope.eventSettings);
      console.log(errors);
      console.log($scope.eventSettings);
      if(errors.length > 0) {
        $scope.eventSettings.scheduleErrors = errors;
        return;
      } else {
        $scope.eventSettings.scheduleErrors = [];
        //clean up the schedule of nonsense
        _.forEach($scope.eventSettings.schedule, function(item, index) {
          if(item.hasOwnProperty("type")) {
            delete item.type
          }

          item.id = index + 1;

        });

        console.log($scope.eventSettings);

        DBService.db.put($scope.eventSettings)
        .then(function(){
          $scope.$apply($location.path('/event/settings'));
        })
        .catch(function(err){
          console.log(err);
        });

      }
    }

    $scope.isExtra = function(item) {
      return _.find($scope.eventSettings.scheduleErrors, {
        'category': item.category,
        'round': item.round,
        'roundNo': item.roundNo,
        'type': 403 || 405
      });
    }

    $scope.outOfPlace = function(item) {
      return _.find($scope.eventSettings.scheduleErrors, {
        'category': item.category,
        'round': item.round,
        'roundNo': item.roundNo,
        'type': 500
      });
    }

    $scope.roundIsUnrecognised = function(round) {
      return !_.includes(
        ["HEAT",
          "RND",
          "RND2",
          "FLH",
          "REPE",
          "SEMI",
          "PLFN",
          "MNFN",
          "GNFN"
        ],
        round);
    };

    $scope.remove = function(index) {
      $scope.eventSettings.schedule.splice(index, 1);
    };

    DBService.getActiveEvent()
      .then(function(e) {
        $scope.$apply($scope.eventSettings = e);
        $scope.$apply($scope.missing = _.filter($scope.eventSettings.scheduleErrors, {
          'type': 404
        }));
        console.log($scope.missing);
        console.log($scope.eventSettings);
      })
      .catch(function(err) {
        console.log(err);
        $location.path("/");
      });

  });
