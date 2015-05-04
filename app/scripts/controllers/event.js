angular.module('sdbaApp')
  .controller('EventCtrl', function($scope, DBService, $location, $rootScope, $route) {
    $scope.waitOutput = false;

    DBService.getActiveEvent()
      .then(function(e) {
        $scope.$apply($scope.event = e);
        console.log($scope.event);
        if (e.hasOwnProperty('activeRace')) {
          if (e.activeRace) {
            DBService.setActiveRace(e.activeRace);
            DBService.db.get(e.activeRace)
              .then(function(r) {
                $scope.$apply($scope.race = r);
                if(DBService.newRoundReturn) {
                  continueRace();
                } else{
                  presentRace();
                }
              })
              .catch(function(err) {
                console.log(err);
              });
          } else {
            loadFirstRace();
          }
        } else {
          loadFirstRace();
        }
      })
      .catch(function(err) {
        console.log(err);
        $location.path("/");
      });

    var loadFirstRace = function() {
      DBService.getRace($scope.event.eventID, $scope.event.schedule[0])
        .then(function(r) {
          DBService.setActiveRace(r._id);
          $scope.event.activeRace = r._id;
          $scope.$apply($scope.race = r);
          presentRace();
        });
    };


    var presentRace = function() {
      var scheduleItem = _.find($scope.event.schedule, {
        'category': $scope.race.category,
        'roundNo': $scope.race.roundNo,
        'round': $scope.race.round
      });
      scheduleItem.catName = $scope.event.categories[$scope.race.category].name;
      DBService.getRaceTeams($scope.race)
        .then(function(teams) {
          console.log(teams);
          console.log($scope.race);
          var t = [];
          _.forEach(teams.rows, function(val, key) {
            console.log(val.doc.categories);
            console.log($scope.race.category);
            var cat = val.doc.categories[$scope.race.category];
            console.log(cat);
            cat[$scope.race.round] = {
              lane: key + 1,
              time: 0
            };
            t.push(val.doc);
          });
          $scope.$apply($scope.teams = t);
          console.log($scope.teams);
          $scope.race['raceID'] = scheduleItem.id;
          return DBService.db.put($scope.race)
        })
        .then(function() {
          return DBService.db.get($scope.race._id);
        })
        .then(function(r) {
          $scope.$apply($scope.schedule = scheduleItem);
          $scope.$apply($scope.race = r);
        });
    };

    var continueRace = function(i) {
      //sets new active race, save the $scope.event, reloads view
      console.log("going to next event");
      console.log($scope.event);
      var currentIndex = _.findIndex($scope.event.schedule, function(item) {
        return item.round === $scope.race.round && item.roundNo === $scope.race.roundNo && item.category === $scope.race.category;
      });

      if(i) {
        currentIndex = i;
      }

      if (currentIndex === $scope.event.schedule.length - 1) {
        //last event
        $location.path("/");
      } else {
        DBService.getRace($scope.event.eventID, $scope.event.schedule[currentIndex + 1])
          .then(function(race) {
            $scope.event.activeRace = race._id;
            return DBService.db.put($scope.event);
          })
          .then(function() {
            console.log("next race!");
            $route.reload();
          })
          .catch(function(err) {
            console.log(err);
            if (err.status == 404) {
              //event doesnt exist in schedule
              continueRace(currentIndex++);
            }
          });
      }

    };

    $scope.$on('$locationChangeStart', function(e) {
      if ($scope.waitOutput) {
        e.preventDefault();
      }
    });


    $scope.nextRace = function() {


      //firms the team's timings
      _.forEach($scope.teams, function(team) {
        var cat = team.categories[$scope.race.category];
        cat[$scope.race.round].time = team["latestTiming_" + cat.id];
      });

      console.log($scope.teams);
      console.log($scope.event);

      //set the race winner
        var s = _.sortBy($scope.teams, 'latestTiming_' + $scope.race.category);
        $scope.race.winner = s[0].teamID;
        var winningTeam = _.find($scope.teams, {
          'teamID': $scope.race.winner
        });
        var c = winningTeam.categories[$scope.race.category];

        c[$scope.race.round].winner = true;

      console.log("winner is");
      console.log($scope.race);

      //update everything
      var toBeUpdated = [];
      Array.prototype.push.apply(toBeUpdated, $scope.teams);
      toBeUpdated.push($scope.race);

      console.log("Updating the following");
      console.log(toBeUpdated);

      DBService.db.bulkDocs(toBeUpdated)
        .then(function(r) {
          //is this the last event of the current round?
          var raceCat = $scope.event.categories[$scope.race.category];
          //these numbers must be set correctly from the start-- in eventSettingsjs
          if (parseInt($scope.race.roundNo) === raceCat.progression[$scope.race.round]) {
            //current round = total no. of rounds
            //generate next round then go next race
            $scope.$apply($location.path("/event/nextround"));
            $location.path("/event/nextround");
          } else {
            //go to next race;
            continueRace();
          };

        })
        .catch(function(err) {
          console.log(err);
        });
    };

    $scope.outputEvent = function() {
      //here lies node.
      if (!window.require) {
        //prevent browser crashes for testing
        return;
      }
      var fs = require('fs');
      var parse = require('csv-parse');
      //platform appropriate end of line character
      var eolChar = require('os').EOL;

      var evt = "";
      //if this is a new event, clear the Lynx file
      if ($scope.race.raceID !== 1) {
        var previousData = fs.readFileSync($rootScope.settings.inputd + '/Lynx.evt', {
          encoding: 'utf8'
        });
        evt = previousData;
      };

      //first line denoting race info
      evt += $scope.race.raceID + ',1,1,' + $scope.event.eventID + eolChar;

      _.forEach($scope.teams, function(team, key) {
        var lane = key + 1;
        evt += "," + team.teamID + ',' + lane + ',,' + team.name + eolChar;
      });

      fs.writeFileSync($rootScope.settings.inputd + '/Lynx.evt', evt);
      console.log("EVT file updated, now watching directory for updates");
      $scope.waitOutput = true;

      var results = "";

      var simulate = $('#simulate');
      simulate.click(function(e) {
        console.log("simulating RESULTS!");
        watcher.close();
        _.forEach($scope.teams, function(team) {
          var cat = team.categories[$scope.race.category];
          team['latestTiming_' + cat.id] = Math.random() * 100.100;

          cat[$scope.race.round].roundNo = $scope.race.roundNo;

        });

        console.log($scope.teams);

        $scope.race['completed'] = true;
        console.log($scope.race);
        $scope.$apply($scope.race = $scope.race);
        $scope.$apply($scope.teams = $scope.teams);
        $scope.$apply($scope.waitOutput = false);
      });


      var watcher = fs.watch($rootScope.settings.outputd, {
        persistent: true
      }, function(event, filename) {
        console.log("Lynx output directory changed");
        console.log(filename);
        if (!filename) {
          console.log("Filename not provided");
          var files = fs.readdirSync($rootScope.settings.outputd);
          filename = _.find(files, function(file) {
            if ($scope.race.raceID === 1) {
              return file.includes("001-1-01");
            } else {
              return file.includes($scope.race.raceID);
            }
          });
        }

        if (!filename.includes('lif')) {
          console.log("Doesnt include lif");
          return;
        }

        results = fs.readFileSync($rootScope.settings.outputd + "/" + filename, {
          encoding: 'utf8'
        });

        parse(results, function(err, output) {
          console.log(output);
          if (parseInt(output[0][0]) === $scope.race.raceID) {
            console.log("closing watcher");
            watcher.close();
          } else {
            return;
          }
          //go through every line of the output
          for (var i = 1; i <= output.length; i++) {
            var team = _.find($scope.teams, {
              'teamID': parseInt(output[i][1])
            });
            if (!team) {
              break;
            }
            team.categories[$scope.race.category];

            //cat[$scope.race.round].time = output[i][6];
            cat[$scope.race.round].roundNo = $scope.race.roundNo;

            team['latestTiming_' + $scope.race.category.id] = output[i][6];
          }

          console.log($scope.teams);

          $scope.race['completed'] = true;
          console.log($scope.race);
          $scope.$apply($scope.race = $scope.race);
          $scope.$apply($scope.teams = $scope.teams);
          $scope.$apply($scope.waitOutput = false);
          console.log(output);
        });

      });
    };

  });
