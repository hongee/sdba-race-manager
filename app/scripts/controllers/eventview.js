angular.module('sdbaApp')
  .controller('EventViewCtrl', function($scope, DBService, $routeParams, $rootScope, $location) {
    console.log($routeParams);
    //great! now load the entire event
    //the params passed should be the event id

    $scope.event = {};

    $scope.print = function() {
      window.print();
    }

    $scope.getLane = function(team, race) {
      var laneNo = _.findKey(race, function(id,key) {
        if(key.includes('LANE')) {
          return id == team.teamID;
        }
      });

      return laneNo.match(/\d+/)[0];
    }

    var loadAll = function() {
      DBService.setActiveEvent($routeParams.eventID)
      DBService.getActiveEvent()
        .then(function(event) {
          $scope.$apply($scope.event = event);
          //get all the races of each category - then sort them into the respective
          console.log(event);
          _.forEach($scope.event.categories, function(cat, catID) {
            cat.rounds = {};
            _.forEach(cat.progression, function(val, round) {
              //irrelevant keys to ignore
              var ignore = ["FLH", "max_teams"];
              if (_.includes(ignore, round)) {
                return;
              } else {
                DBService.getAllRacesOfRound(cat.id, round)
                  .then(function(r) {
                    var races = _.map(r.rows, function(race) {
                      return race.doc;
                    });
                    _.forEach(races, function(race) {
                      DBService.getRaceTeams(race)
                        .then(function(t) {
                          var teams = _.map(t.rows, function(team) {
                            return team.doc;
                          });

                          var sortedByTime = _.sortBy(teams, function(team) {
                            if (team.categories[race.category][race.round]) {
                              return team.categories[race.category][race.round].time
                            } else {
                              return 0;
                            }
                          });

                          _.forEach(teams, function(team) {
                            team.pos = _.findIndex(sortedByTime, {
                              'teamID': team.teamID
                            }) + 1;
                          });

                          race.teams = teams;
                          cat.rounds[round] = races;
                          $scope.$apply($scope.event.categories[catID] = cat);
                          console.log($scope.event);
                        });
                    })

                  });
              }

            });
          });

        });
    }

    loadAll();
  });
