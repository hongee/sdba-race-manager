angular.module('sdbaApp')
  .controller('EventScheduleCtrl', function($scope, DBService, $location, $rootScope) {
    $rootScope.notCenter = true;

    $scope.eventSettings = {};
    $scope.missing = [];
    $scope.currentPage = 1;

    $scope.existingErrors = function() {
      if ($scope.missing.length !== 0) {
        return true;
      }

      if ($('.danger').length > 0) {
        return true;
      }

    }

    $scope.afterActive = function(item, index) {

      if(!$scope.hasOwnProperty('activeRace')) {
        return false;
      }

      var activeIndex = _.findIndex($scope.eventSettings.schedule, {
        'category': $scope.activeRace.category,
        'round': $scope.activeRace.round,
        'roundNo': $scope.activeRace.timeTrial ? "timetrial_" + $scope.activeRace.roundNo : $scope.activeRace.roundNo
      });
      if (index <= activeIndex) {
        return true;
      }
    }

    $scope.save = function() {
      //reassign ids, get rid of
      //validate schedule here (again)
      var errors = DBService.validateSchedule($scope.eventSettings);
      console.log(errors);
      console.log($scope.eventSettings);
      if (errors.length > 0) {
        $scope.eventSettings.scheduleErrors = errors;
        return;
      } else {
        $scope.eventSettings.scheduleErrors = [];
        //clean up the schedule of nonsense
        _.forEach($scope.eventSettings.schedule, function(item, index) {
          if (item.hasOwnProperty("type")) {
            delete item.type
          }

        });

        console.log($scope.eventSettings);

        DBService.db.put($scope.eventSettings)
          .then(function() {
            $scope.$apply($location.path('/event/settings'));
          })
          .catch(function(err) {
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

    $scope.opts = {
      items: "tr:not(.active)"
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

        if (e.activeRace) {
          DBService.db.get(e.activeRace)
            .then(function(r) {
              $scope.$apply($scope.activeRace = r);

              $scope.$apply($scope.eventSettings = e);
              $scope.$apply($scope.missing = _.filter($scope.eventSettings.scheduleErrors, {
                'type': 404
              }));

              var changes = $rootScope.db.changes({
                  since: 'now',
                  live: true,
                  include_docs: true,
                  doc_ids: [e._id]
                })
                .on('change', function(newSettings) {
                  console.log("settings changed");
                  $scope.$apply($scope.eventSettings = newSettings.doc);
                });


            });
        } else {
          $scope.$apply($scope.eventSettings = e);
          $scope.$apply($scope.missing = _.filter($scope.eventSettings.scheduleErrors, {
            'type': 404
          }));


          var changes = $rootScope.db.changes({
              since: 'now',
              live: true,
              include_docs: true,
              doc_ids: [e._id]
            })
            .on('change', function(newSettings) {
              console.log("settings changed");
              $scope.$apply($scope.eventSettings = newSettings.doc);
            });

        }

        console.log($scope.missing);
        console.log($scope.eventSettings);
      })
      .catch(function(err) {
        console.log(err);
        $location.path("/");
      });

  });
