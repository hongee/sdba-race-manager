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
        'roundNo': $scope.race.roundNo,
        'round': $scope.race.round
      });
      scheduleItem.catName = _.find($scope.event.categories, {
        'id': $scope.race.category
      }).name;
      DBService.getRaceTeams($scope.race)
        .then(function(teams) {
          console.log(teams);
          console.log($scope.race);
          var t = [];
          _.forEach(teams.rows, function(val, key) {
            console.log(val.doc.categories);
            console.log($scope.race.category);
            var cat = _.find(val.doc.categories, {
              'id': $scope.race.category
            });
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

    var seedRound = function(round, cat, teams, sort) {

      if (cat.lanes === 4) {
        var seedOrder = [3, 2, 4, 1];
      } else {
        var seedOrder = [3, 4, 2, 5, 1, 6];
      }

      var races = [];
      //sort teams by time
      //only sort if requested
      if (sort) {
        var sortedTeams = _.sortBy(teams, 'latestTiming');
      }

      for (var i = 1; i <= cat.progression[round]; i++) {
        var event = {
          round: round,
          category: cat.id,
          roundNo: i
        };

        _.forEach(_.filter(teams, function(val, index) {
          if ((index - i - 1) % cat.progression[round] === 0) {
            return true;
          }
        }), function(team, index) {
          var laneno = seedOrder[index];
          event['LANE_' + laneno] = team.teamID;
        });

        races.push(event);
      };

      console.log(races);
      return DBService.createRound(races);

    };

    var generateNextRound = function() {
      //what round is this?
      //Race Progression Logic lies here
      DBService.getTeams(true)
        .then(function(r) {
          console.log(r);
          var teams = _.map(r.rows, function(t) {
            return t.doc;
          });
          console.log(teams);

          var cat = _.find($scope.event.categories, {
            'id': $scope.race.category
          });
          var next = "";
          console.log(cat);

          switch ($scope.race.round) {
            case 'HEAT':
              console.log("finished heats");
              //populate REPE first
              var teamIDArr = [];
              var winnersArr = [];

              //remove winning teams
              DBService.getAllRacesOfRound($scope.race.category, 'HEAT')
                .then(function(r) {
                  //yay all heats
                  console.log("result of all race");
                  console.log(r);
                  var races = _.map(r.rows, function(r) {
                    return r.doc;
                  })
                  _.forEach(races, function(race) {
                    _.forEach(race, function(val, key) {
                      if (key.includes('LANE')) {
                        teamIDArr.push(val);
                      }
                    });
                    winnersArr.push(race.winner);
                  });
                  var remainder = _.difference(teamIDArr, winnersArr);
                  console.log("remaining ids");
                  console.log(remainder);
                  console.log(winnersArr);
                  return DBService.getTeamsFromArray(remainder);

                })
                .then(function(re) {
                  var teams = _.map(re.rows, function(r) {
                    return r.doc;
                  });
                  //get fastest losers - rest seed into repe
                  var sortedTeams = _.sortBy(teams, 'latestTiming');

                  //removing fastest losers
                  if (cat.progression.hasOwnProperty('FLH')) {
                    console.log("FLH: " + cat.progression.FLH);
                    var fl = _.take(sortedTeams, cat.progression.FLH);
                    var repeTeams = _.drop(sortedTeams, cat.progression.FLH);
                  } else {
                    var repeTeams = sortedTeams;
                  }

                  //convert winners id into teams

                  //stores the fastest losers in event for future

                  DBService.getTeamsFromArray(winnersArr)
                    .then(function(r) {
                      var winTeams = _.map(r.rows, function(r) {
                        return r.doc;
                      });

                      cat['HEAT_winners'] = winTeams;
                      cat['HEAT_fl'] = fl;

                      console.log("Seeding REPE with");
                      console.log(repeTeams);

                      return seedRound('REPE', cat, repeTeams)
                    })
                    .then(function() {
                      continueRace();
                    })
                    .catch(function(err) {
                      console.log(err);
                    });
                })
                .catch(function(err) {
                  console.log(err);
                });
              break;
            case 'RND':
              //This will be a bit more complex - the winners will be reseeded
              //into a round called RN2 based on their timings
              //DO THIS!!!
              break;
            case 'REPE':
              console.log("finished REPE");
              if (cat.progression.hasOwnProperty('SEMI')) {
                next = "SEMI";
                //no. I can send
                var quantity = (cat.progression.SEMI * cat.lanes);
              } else {
                next = "GNFN";
                var quantity = 6;
              }
              //how many people can I send?
              quantity -= (cat.HEAT_winners.length + cat.HEAT_fl.length);


              DBService.getAllRacesOfRound($scope.race.category, 'REPE')
                .then(function(r) {
                  //yay all REPEs
                  var races = _.map(r.rows, function(r) {
                    return r.doc;
                  });

                  var repeArr = [];

                  _.forEach(races, function(race) {
                    _.forEach(race, function(val, key) {
                      if (key.includes('LANE')) {
                        repeArr.push(val);
                      }
                    });
                  });
                  return DBService.getTeamsFromArray(repeArr);
                })
                .then(function(r) {
                  var teams = _.map(r.rows, function(r) {
                    return r.doc;
                  });
                  var sortedTeams = _.sortBy(teams, 'latestTiming');
                  var promoted = _.take(sortedTeams, quantity);

                  //as per rules - Sorted heat winners, FLs (already sorted), current promotees
                  var toSeed = [];
                  Array.prototype.push.apply(toSeed, _.sortBy(cat.HEAT_winners, 'latestTiming'));
                  Array.prototype.push.apply(toSeed, cat.HEAT_fl);
                  Array.prototype.push.apply(toSeed, promoted);

                  return seedRound(next, cat, toSeed);
                })
                .then(function() {
                  continueRace();
                })
                .catch(function(err) {
                  console.log(err);
                });
              break;
            case 'SEMI':
              console.log("finished SEMI");
              var winnersArr = [];
              var minor = [];
              DBService.getAllRacesOfRound($scope.race.category, 'SEMI')
                .then(function(r) {
                  var races = _.map(r.rows, function(r) {
                    return r.doc;
                  });

                  var semiArr = [];
                  _.forEach(races, function(race) {
                    _.forEach(race, function(val, key) {
                      if (key.includes('LANE')) {
                        semiArr.push(val);
                      }
                    });
                    winnersArr.push(race.winner);
                  });
                  return DBService.getTeamsFromArray(semiArr);
                })
                .then(function(r) {
                  var teams = _.map(r.rows, function(r) {
                    return r.doc;
                  });

                  var winnerTeams = _.filter(teams, function(team) {
                    return _.includes(winnersArr, team.teamID);
                  });

                  var rTeams = _.filter(teams, function(team) {
                    return !(_.includes(winnersArr, team.teamID));
                  });

                  var sortedWinners = _.sortBy(winnerTeams, 'latestTiming');
                  var sortedTeams = _.sortBy(rTeams, 'latestTiming');

                  //put first 6 into grand
                  Array.prototype.push.apply(sortedWinners, _.take(sortedTeams, 6 - sortedWinners.length));
                  sortedTeams = _.drop(sortedTeams, 6 - sortedWinners.length);
                  Array.prototype.push.apply(minor, _.take(sortedTeams, 6));

                  return seedRound("GDFN", cat, sortedWinners);
                })
                .then(function(r) {
                  if (cat.progression.hasOwnProperty('MNFN')) {
                    seedRound("MNFN", cat, minor)
                      .then(function() {
                        continueRace();
                      });
                  } else {
                    continueRace();
                  }
                })
                .catch(function(err) {
                  console.log(err);
                });

              //Winners go GNFN, fill GN,MN with next fastest,
              break;
            case 'MNFN':
              continueRace();
              //Nothing to do here
              break;
            case 'GNFN':
              continueRace();
              //Nothing to do here.
              break;
            case 'RN2':
              //promote to GNFN??
              break;
          }
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
              continueRace(currentIndex + 1);
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
        var cat = _.find(team.categories, {
          'id': $scope.race.category
        });
        cat[$scope.race.round].time = team.latestTiming;
      });

      console.log($scope.teams);
      console.log($scope.event);

      if ($scope.race.round === "HEAT" || $scope.race.round === "SEMI") {
        var s = _.sortBy($scope.teams, 'latestTiming');
        $scope.race.winner = s[0].teamID;
        var winningTeam = _.find($scope.teams, {
          'teamID': $scope.race.winner
        });
        var c = _.find(winningTeam.categories, {
          'id': $scope.race.category
        });
        c[$scope.race.round].winner = true;
      }

      console.log("winner is");
      console.log($scope.race);

      //update everything
      var toBeUpdated = [];
      Array.prototype.push.apply(toBeUpdated, $scope.teams);
      toBeUpdated.push($scope.race);

      console.log("Updating the following");
      console.log(toBeUpdated);

      DBService.db.bulkDocs(toBeUpdated)
        .then(function() {
          //is this the last event of the current round?
          var raceCat = _.find($scope.event.categories, {
            'id': $scope.race.category
          });
          //these numbers must be set correctly from the start-- in eventSettingsjs
          if (parseInt($scope.race.roundNo) === raceCat.progression[$scope.race.round]) {
            //current round = total no. of rounds
            //generate next round then go next race
            generateNextRound();
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

          team.latestTiming = Math.random() * 100.100;

          var cat = _.find(team.categories, {
            'id': $scope.race.category
          });
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
            var cat = _.find(team.categories, {
              'id': $scope.race.category
            });
            //cat[$scope.race.round].time = output[i][6];
            cat[$scope.race.round].roundNo = $scope.race.roundNo;

            team.latestTiming = output[i][6];
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
