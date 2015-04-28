angular.module('sdbaApp')
  .controller('EventSettingsCtrl', function($scope, DBService, $location, $rootScope) {

    $scope.eventSettings = {};
    $scope.confirmDeleteString = "";

    DBService.getActiveEvent()
      .then(function(e) {
        $scope.$apply($scope.eventSettings = e);
        if ($scope.eventSettings.categories[0].hasOwnProperty('totalTeams')) {
          DBService.retrieve("race_" + $scope.eventSettings.eventID)
          .then(function(e){
            if(e.rows.length !== 0) {
              $scope.$apply($scope.prior = true);
            }
          });
        } else {
          setRaceProgression();
        }
      })
      .catch(function(err) {
        console.log(err);
        $location.path("/");
      });

    var calculateRaceProgression = function(teams, lanes) {
      if (lanes === 6) {
        lanes = "six"
      } else {
        lanes = "four"
      }
      var setting = _.find($rootScope.settings.raceProgression[lanes], function(val) {
        return teams <= val.max_teams;
      });

      //number of repe is variable - set repechage & FL
      //ANY DYNAMIC ROUND GENERATION GOES HERE -
      //AFT THIS, THIS SHALL BE THE SOURCE OF TRUTH

      /*
      if(lanes == 6) {
        if(setting.hasOwnProperty('REPE')) {
          var repe = setting.
        }
      } else {
        //4 lanes repechage - not known yet
      }
      */

      return setting;
    };

    var setRaceProgression = function() {
      DBService.getTeams(true)
        .then(function(teams) {
          //this is done at 1am and i cant think anymore sorry about the mess.
          _.forEach(teams.rows, function(team) {
            _.forEach(team.doc.categories, function(cat) {
              //todo rewrite this as _.find
              _.forEach($scope.eventSettings.categories, function(c) {
                if (c.id === cat.id) {
                  if (!c.hasOwnProperty('totalTeams')) {
                    c['totalTeams'] = 0;
                  }
                  c.totalTeams++;
                }
              });
            });
          });

          _.forEach($scope.eventSettings.categories, function(c) {
            c.lanes = 6;
            c.progression = calculateRaceProgression(c.totalTeams, 6);
          });

          DBService.db.put($scope.eventSettings);
          $scope.$apply($scope.eventSettings = $scope.eventSettings);

        });
    };

    $scope.generateHeats = function() {
      //for now im randomly assigning internally but will need to implement a RNG thing for their future purposes
      DBService.getTeams(true)
        .then(function(result) {
          var teams = _.map(result.rows, function(val) {
            return val.doc;
          });

          var RNGArray = [];
          //generate an array of numbers from 1 - 1000  then popping the arr to ensure no repeats
          for (var i = 1; i <= 1000; i++) {
            RNGArray.push(i);
          }

          _.forEach(teams, function(team) {
            var n = parseInt(RNGArray.length * Math.random());
            team.rng = RNGArray[n];
            _.pullAt(RNGArray, n);
          });

          _.forEach($scope.eventSettings.categories, function(category) {
            var thisCatTeams = _.sortBy(_.filter(teams, function(team) {
              return _.find(team.categories, {
                'id': category.id
              });
            }), 'rng');

            console.log(thisCatTeams);
            //create heats/rounds
            var catFirstRound = [];
            //does this have heats?
            var firstRound = {
              type: 'HEAT',
              limit: 1
            };

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
              //populate lanes by refering to indexes that are multiples of i (striping?)
              _.forEach(_.filter(thisCatTeams, function(val, index) {
                if ((index - i - 1) % firstRound.limit === 0){
                  return true;
                }
              }), function(team, index) {
                var laneno = index +1;
                event['LANE_'+laneno] = team.teamID;
                /* required later
                switch (index) {
                  case 0:
                    event['LANE_3'] = team.teamID;
                    break;
                  case 1:
                    event['']
                    break;
                  case 2:
                    break;
                  case 3:
                    break;
                  case 4:
                    break;
                  case 5:
                    break;
                }
                */
              });
              catFirstRound.push(event);
            }

            DBService.createRound(catFirstRound)
            .then(function(){
              $scope.heatsGenerated = true;
            });

          });

        });

    }

    $scope.deleteEvent = function() {

    };

  });
