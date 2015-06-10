angular.module('sdbaApp')
  .controller('PrintCtrl', function($scope, DBService, $routeParams, $rootScope, $location) {
    console.log($routeParams);
    //great! now load the entire event
    //the params passed should be the event id

    $scope.event = {};

    $scope.print = function() {

      if (!window.require) {
        //prevent browser crashes for testing
        return;
      }

      var chooser = $('#saveCsv');
      chooser.change(function(e) {
        var location = $(this).val();

        console.log(location);

        var fs = require('fs');
        var eolChar = require('os').EOL;

        var csv = "";

        var eolChar = "\n";

        csv += 'RACE,HEAT,LANE,TEAM' + eolChar;

        _.forEach($scope.event.categories, function(cat) {
          _.forEach(cat.round, function(race) {
            _.forEach(race.teams, function(team) {
              csv += cat.id + ',' + race.roundNo + ',' + $scope.getLane(team, race) + ',' + team.name + eolChar;
            })
          })
        });

        fs.writeFileSync(location + '.csv', csv);

      });
      chooser.trigger('click');

    }

    $scope.getLane = function(team, race) {
      var laneNo = _.findKey(race, function(id, key) {
        if (key.includes('LANE')) {
          return id == team.teamID;
        }
      });

      return laneNo.match(/\d+/)[0];
    }


    var loadAll = function() {

      $scope[$routeParams.type] = true;

      DBService.setActiveEvent($routeParams.eventID)
      DBService.getActiveEvent()
        .then(function(event) {
          $scope.$apply($scope.event = event);

          switch ($routeParams.type) {
            case 'rng':

              break;

            case 'rngall':

              _.forEach($scope.event.categories, function(cat, catID) {
                cat.rounds = {};
                _.forEach(cat.progression, function(val, round) {
                  //first round only
                  var relevant = ["RND", "HEAT"];
                  if (_.includes(relevant, round)) {
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

                              race.teams = teams;
                              cat.round = races;
                              $scope.$apply($scope.event.categories[catID] = cat);
                              console.log($scope.event);
                            });
                        })

                      });
                  }

                });
              });

              break;

            case 'raw':
              break;

            case 'confirmed':
              break;

            case 'complete':
              break;
          }

          //get all the races of each category - then sort them into the respective
          console.log(event);

        });
    }

    loadAll();
  });
