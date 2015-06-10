angular.module('sdbaApp')
  .controller('EventCtrl', function($scope, DBService, $location, $rootScope, $route) {
    $scope.waitOutput = false;
    $rootScope.notCenter = false;
    $scope.schError = false;

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
                presentRace();
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
        'roundNo': ($scope.race.timeTrial ? 'timetrial_' + $scope.race.roundNo : $scope.race.roundNo),
        'round': $scope.race.round
      });
      scheduleItem.catName = $scope.event.categories[$scope.race.category].name;
      DBService.getRaceTeams($scope.race)
        .then(function(teams) {
          var t = [];

          _.forEach(teams.rows, function(val, key) {

            var cat = val.doc.categories[$scope.race.category];

            var laneNo = _.findKey($scope.race, function(id, key) {
              if (key.includes('LANE')) {
                return id === val.doc.teamID;
              }
            });

            cat[$scope.race.round] = {
              lane: laneNo.match(/\d+/)[0],
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

    $scope.skipEvent = function() {

      DBService.db.get($scope.event._id)
        .then(function(e) {

          //swaps this index and the next index
          var currentIndex = _.findIndex(e.schedule, function(item) {
            return item.round === $scope.race.round && item.roundNo === ($scope.race.timeTrial ? "timetrial_" + $scope.race.roundNo : $scope.race.roundNo) && item.category === $scope.race.category;
          });

          var currentItem = _.cloneDeep(e.schedule[currentIndex]);
          nextItem = _.cloneDeep(e.schedule[currentIndex + 1]);

          if (currentItem && nextItem) {
            e.schedule[currentIndex] = nextItem;
            e.schedule[currentIndex + 1] = currentItem;

            DBService.getRace(e.eventID, nextItem)
              .then(function(r) {
                e.activeRace = r._id;
                if (e.scheduleErrors.length) {
                  $scope.$apply($scope.schError = true);
                  throw {
                    status: 500
                  };
                }
                return DBService.db.put(e);
              })
              .then(function() {
                console.log("next race!");
                $route.reload();
              })
              .catch(function(err) {
                console.log(err);
                if (err.status == 404) {
                  //event doesnt exist in schedule
                  $scope.$apply($scope.notFound = e.schedule[currentIndex + 1]);
                  console.log(nextItem);
                  console.log("Was Not Found!");
                  if(!$scope.race.complete) {
                    alert(nextItem.category + ' ' + nextItem.round + ' ' + nextItem.roundNo + ' is not ready. Please check with the event manager.');
                  }
                }
              });

          } else {
            throw new Error("The next item in the schedule is undefined");
          }
        })
        .catch(function(err) {
          console.log(err);
          alert(err);
        })

    }

    $scope.continueRace = function(i) {
      //sets new active race, save the $scope.event, reloads view
      console.log("going to next event");
      console.log($scope.event);
      console.log($scope.race);

      DBService.db.get($scope.event._id)
        .then(function(e) {

          var currentIndex = _.findIndex(e.schedule, function(item) {
            return item.round === $scope.race.round && item.roundNo === ($scope.race.timeTrial ? "timetrial_" + $scope.race.roundNo : $scope.race.roundNo) && item.category === $scope.race.category;
          });

          if (currentIndex === e.schedule.length - 1) {
            //last event
            console.log("is last event");
            $scope.$apply($location.path("/event/view/" + e.eventID));
          } else {

            console.log(currentIndex);

            var nextRace = {};

            DBService.getRace(e.eventID, e.schedule[currentIndex + 1])
              .then(function(race) {

                nextRace = race;
                //ensure we're updating the latest edition of the event!

                console.log(nextRace);

                e.activeRace = nextRace._id;
                if (e.scheduleErrors.length) {
                  $scope.$apply($scope.schError = true);
                  throw {
                    status: 500
                  };
                }
                return DBService.db.put(e);
              })
              .then(function() {
                console.log("next race!");
                $route.reload();
              })
              .catch(function(err) {
                console.log(err);
                if (err.status == 404) {
                  //event doesnt exist in schedule
                  $scope.$apply($scope.notFound = e.schedule[currentIndex + 1]);
                  console.log(e.schedule[currentIndex + 1]);
                  console.log("Was Not Found!");
                }
              });
          }


        });


    };

    $scope.$on('$locationChangeStart', function(e) {
      if ($scope.waitOutput) {
        e.preventDefault();
      }
    });


    $scope.nextRace = function() {

      //update everything
      var toBeUpdated = [];
      //Array.prototype.push.apply(toBeUpdated, $scope.teams);
      DBService.db.get($scope.race._id)
        .then(function(r) {
          if (r.completed) {
            $scope.continueRace();
            throw new Error("Race Already Completed!");
          } else {
            r.completed = true;
            r.completedAt = $scope.race.completedAt;

            toBeUpdated.push(r);

            return DBService.getRaceTeams($scope.race);
          }
        })
        .then(function(r) {
          var teams = _.map(r.rows, function(team) {
            var cat = team.doc.categories[$scope.race.category];

            var correspondingTeam = _.find($scope.teams, {
              '_id': team.doc._id
            });

            var laneNo = _.findKey($scope.race, function(id, key) {
              if (key.includes('LANE')) {
                return id === team.doc.teamID;
              }
            });

            cat[$scope.race.round] = {
              lane: laneNo.match(/\d+/)[0],
              time: 0,
              roundNo: $scope.race.roundNo
            };


            var times = correspondingTeam['latestTiming_' + cat.id].split(':');
            var finalTime = 0;
            if (times[1]) {
              //there is ':'
              finalTime += parseInt(times[0]) * 60;
              finalTime += parseFloat(times[1]);
            } else {
              finalTime += parseFloat(times[0]);
            }

            team.doc['latestTiming_' + cat.id] = finalTime;

            return team.doc;
          });

          console.log(teams);

          toBeUpdated = toBeUpdated.concat(teams);
          console.log("Updating the following");
          console.log(toBeUpdated);

          return DBService.db.bulkDocs(toBeUpdated);
        })
        .then(function() {
          $scope.continueRace();
        })
        .catch(function(err) {
          alert(err);
          console.log(err);
        })


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
      var chokidar = require('chokidar');
      var path = require('path');

      var evt = "";
      //if this is a new event, clear the Lynx file
      if ($scope.race.raceID !== '1') {

        try {
          var previousData = fs.readFileSync($rootScope.settings.inputd + '/Lynx.evt', {
            encoding: 'utf8'
          });
          evt = previousData;
        } catch (err) {
          console.log(err);
          if (err.code === "ENOTFOUND") {
            window.alert("No existing EVT was found!")
          } else {
            window.alert("Error encountered in trying to read EVT file");
          }
        }


      }

      if (evt.indexOf($scope.race.raceID + ',1,1,' + $scope.event.eventID + eolChar) === -1) {
        evt += $scope.race.raceID + ',1,1,' + $scope.event.eventID + eolChar;

        _.forEach($scope.teams, function(team, key) {
          var lane = team.categories[$scope.race.category][$scope.race.round].lane;
          evt += "," + team.teamID + ',' + lane + ',,' + team.name + eolChar;
        });

        fs.writeFileSync($rootScope.settings.inputd + '/Lynx.evt', evt);
        console.log("EVT file updated, now watching directory for updates");
      } else {
        console.log("EVT contains race info! not writing");
      }

      //first line denoting race info
      $scope.waitOutput = true;

      var results = "";

      var simulate = $('#simulate');
      simulate.click(function(e) {
        console.log("simulating RESULTS!");

        watcher.close();

        _.forEach($scope.teams, function(team) {
          var cat = team.categories[$scope.race.category];
          team['latestTiming_' + cat.id] = (Math.random() * 100.100).toFixed(3);

          cat[$scope.race.round].roundNo = $scope.race.roundNo;

        });

        console.log($scope.teams);

        $scope.race.completed = true;
        $scope.race.completedAt = Date.now();
        console.log($scope.race);
        $scope.$apply($scope.race = $scope.race);
        $scope.$apply($scope.teams = $scope.teams);
        $scope.$apply($scope.waitOutput = false);
      });

      console.log(path.join($rootScope.settings.outputd, '*.lif'));

      var watcher = chokidar.watch(path.join($rootScope.settings.outputd, '*.lif'), {
        ignorePermissionErrors: false,
        atomic: true
      });

      console.log(watcher);

      var select = $('#manualLif');
      select.click(function() {
        var chooser = $('#lifSelector');

        chooser.change(function(e) {
          var loc = $(this).val();

          while (true) {
            try {
              results = fs.readFileSync(loc, {
                encoding: 'utf8'
              });
              break;
            } catch (err) {
              console.log(err);
              if (err.code !== "EBUSY") {
                window.alert("error encountered in trying to read file");
                break;
              }
            }
          }

          parse(results, function(err, output) {
            console.log(output);
            if (output[0][0] === $scope.race.raceID) {
              console.log("closing watcher");
              watcher.close();
            } else {
              window.alert('There is an error in the LIF file! Got ' + parseInt(output[0][0]) + ' expected ' + $scope.race.raceID);
              return;
            }
            //go through every line of the output
            for (var i = 1; i < output.length; i++) {
              var team = _.find($scope.teams, {
                'teamID': parseInt(output[i][1])
              });
              if (!team) {
                break;
              }
              var cat = team.categories[$scope.race.category];
              cat[$scope.race.round].roundNo = $scope.race.roundNo;

              //if no timing assume did not complete

              team['latestTiming_' + $scope.race.category] = output[i][6].length ? output[i][6] : '99:99.99';
            }

            console.log($scope.teams);

            $scope.race.completed = true;
            $scope.race.completedAt = Date.now();
            console.log($scope.race);
            $scope.$apply($scope.race = $scope.race);
            $scope.$apply($scope.teams = $scope.teams);
            $scope.$apply($scope.waitOutput = false);
            console.log(output);
          });

        });

        chooser.trigger('click');

      });

      watcher.on('add', function(filepath) {
        console.log(filepath + ' happened');

        while (true) {
          try {
            results = fs.readFileSync(filepath, {
              encoding: 'utf8'
            });
            break;
          } catch (err) {
            console.log("error encountered in trying to read file");
            console.log(err);
            if (err.code !== "EBUSY") {
              break;
            }
          }

        }


        parse(results, function(err, output) {
          console.log(output);
          if (output[0][0] === $scope.race.raceID) {
            console.log("closing watcher");
            watcher.close();
          } else {
            console.log('got ' + parseInt(output[0][0]) + ' expected ' + $scope.race.raceID);
            console.log("the file is wrong!!")
            return;
          }
          //go through every line of the output
          for (var i = 1; i < output.length; i++) {
            var team = _.find($scope.teams, {
              'teamID': parseInt(output[i][1])
            });
            if (!team) {
              break;
            }
            var cat = team.categories[$scope.race.category];
            cat[$scope.race.round].roundNo = $scope.race.roundNo;

            //if no timing assume did not complete

            team['latestTiming_' + $scope.race.category] = output[i][6].length ? output[i][6] : '99:99.99';
          }

          console.log($scope.teams);

          $scope.race.completed = true;
          $scope.race.completedAt = Date.now();
          console.log($scope.race);
          $scope.$apply($scope.race = $scope.race);
          $scope.$apply($scope.teams = $scope.teams);
          $scope.$apply($scope.waitOutput = false);
          console.log(output);
        });


      })

    };

  });
