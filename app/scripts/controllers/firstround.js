angular.module('sdbaApp')
  .controller('FirstRndCtrl', function($scope, DBService, $rootScope, $route, $location, $modal) {
    $rootScope.notCenter = true;

    $scope.event = {};

    var loadAll = function() {
      DBService.getActiveEvent()
        .then(function(event) {
          $scope.$apply($scope.event = event);
          //get all the races of each category - then sort them into the respective
          console.log(event);
          _.forEach($scope.event.categories, function(cat, catID) {
            DBService.getTeams(true)
              .then(function(t) {
                var teams = _.map(t.rows, function(team) {
                  return team.doc;
                });

                var filteredTeams = _.filter(teams, function(t) {
                  return t.categories.hasOwnProperty(catID);
                });

                cat.teams = filteredTeams;

                console.log($scope.event);
                $scope.$apply($scope.event = $scope.event);
              });

          });
        })
        .catch(function(err) {
          console.log(err);
          $location.path("/");
        });
    }

    $scope.getLane = function(team, race) {
      var laneNo = _.findKey(race, function(id, key) {
        if (key.includes('LANE')) {
          return id == team.teamID;
        }
      });

      return laneNo.match(/\d+/)[0];
    }


    $scope.reset = function(category) {
      category.generated = false;
      _.forEach(category.teams, function(team) {
        team.rng = null;
      });

    }

    $scope.generateHeats = function(category) {

      var RNGArray = [];
      //generate an array of numbers from 1 - 9999  then popping the arr to ensure no repeats
      for (var i = 1; i <= 9999; i++) {
        RNGArray.push(i);
      }

      _.forEach(category.teams, function(team) {
        var n = parseInt(RNGArray.length * Math.random());
        team.rng = RNGArray[n];
        _.pullAt(RNGArray, n);
      });

      var teams = _.sortBy(category.teams, 'rng').reverse();

      //create heats/rounds
      var catFirstRound = [];
      //does this have heats?
      var firstRound = {
        type: 'HEAT',
        limit: 1
      };

      if (category.lanes === 4) {
        var seedOrder = [3, 2, 4, 1];
      } else {
        var seedOrder = [3, 4, 2, 5, 1, 6];
      }


      if (!category.progression.hasOwnProperty('HEAT')) {
        if (category.progression.hasOwnProperty('RND')) {
          //rounds
          firstRound.type = 'RND';
          firstRound.limit = category.progression.RND;
        } else {
          //direct finals
          firstRound.type = 'GNFN';
          firstRound.limit = category.progression.GNFN;
        }
      } else {
        firstRound.limit = category.progression.HEAT;
      }

      for (var i = 1; i <= firstRound.limit; i++) {
        var event = {
          round: firstRound.type,
          category: category.id,
          roundNo: i
        };
        _.forEach(_.filter(teams, function(val, index) {
          if (index % firstRound.limit === (i - 1)) {
            return true;
          }
        }), function(team, index) {
          var laneno = seedOrder[index];
          event['LANE_' + laneno] = team.teamID;
        });
        catFirstRound.push(event);
      }

      category.firstRound = catFirstRound;
      category.firstRoundPresent = catFirstRound;

      _.forEach(category.firstRoundPresent, function(r) {
        DBService.getRaceTeams(r)
          .then(function(t) {
            var teams = _.map(t.rows, function(team) {
              return team.doc;
            });
            r.teams = teams;
            $scope.$apply($scope.event.categories[category.id] = category);
            console.log($scope.event);
          });

      })

      category.generated = true;
    }

    $scope.confirm = function(category) {

      var confirmationDialog = $modal.open({
        templateUrl: 'views/_partials.confirmation.html',
        controller: 'ConfirmationCtrl',
        size: 'sm'
      });

      confirmationDialog.result.then(function(r){
        if(r) {
          DBService.createRound(category.firstRound)
            .then(function() {
              category.done = true;
              $scope.$apply($scope.event = $scope.event);
            });
        }
      });
    }

    loadAll();
  });
