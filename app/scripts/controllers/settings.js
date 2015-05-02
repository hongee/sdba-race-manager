angular.module('sdbaApp')
  .controller('SettingsCtrl', function($scope, $rootScope) {

    $scope.$watch(function() {
      return $rootScope.settings;
    }, function() {
      $scope.appSettings = $rootScope.settings;
    });

    $scope.add = false;
    $scope.edit = '';
    $scope.newEvent = {};

    $scope.addNewEvent = function() {

      //first check is to prevent js from attempting to read a null key which would crash
      //se
      if ($scope.newEvent.hasOwnProperty('key')) {
        if ($scope.newEvent.key.length !== 0) {
          if ($scope.newEvent.key.trim()) {
            if ($rootScope.settings.predefEvents.hasOwnProperty($scope.newEvent.key))
              return;
          } else {
            return;
          }
        } else {
          return;
        }
      } else {
        return;
      }



      $rootScope.settings.predefEvents[$scope.newEvent.key] = $scope.newEvent.name;
      $rootScope.db.put($rootScope.settings)
        .then(function() {
          $scope.add = false;
          $scope.edit = '';
          $scope.newEvent = {};
        })
        .catch(function(e) {
          console.log(e);
        });
    };

    $scope.deleteEvent = function(key) {
      var newPredef = _.omit($rootScope.settings.predefEvents, key);
      $rootScope.settings.predefEvents = newPredef;

      $rootScope.db.put($rootScope.settings)
        .catch(function(e) {
          console.log(e);
        });
    }

    $scope.enableEdit = function(key) {
      $scope.newEvent = {};
      $scope.edit = key;
    };

    $scope.selectdir = function(type) {
      var chooser = $('#' + type + 'Dir');
      chooser.change(function(e) {

        var dir = $(this).val();
        $rootScope.settings[type + 'd'] = dir;

        $rootScope.db.put($rootScope.settings)
          .then(function(r) {
            console.log(r);
            $rootScope.settings._rev = r.rev;
            $scope.$apply($scope.appSettings = $rootScope.settings);
          })
          .catch(function(e) {
            console.log(e);
          });
      });
      chooser.trigger('click');
    };

  });
