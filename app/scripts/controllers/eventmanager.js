angular.module('sdbaApp')
  .controller('EventManagerCtrl', function($scope, DBService, $routeParams, $rootScope, $route, $location, $modal) {
    $rootScope.notCenter = true;

    $scope.event = {};

    $scope.reload = function() {
      $route.reload();
    }

    $scope.allConfirmed = function(races) {
      return _.every(races, {
        'confirmed': true
      });
    };


    $scope.isActiveEvent = function(string) {
      //$scope.event.activeRace
      if ($scope.event.hasOwnProperty('activeRace')) {
        return $scope.event.activeRace.indexOf(string) !== -1;
      } else {
        return false;
      }
    };

    $scope.getLane = function(team, race) {
      var laneNo = _.findKey(race, function(id, key) {
        if (key.includes('LANE')) {
          return id == team.teamID;
        }
      });
      if (laneNo) {
        return laneNo.match(/\d+/)[0];
      }
    }

    $scope.enableEdit = function(team, race) {
      team.edit = {
        time: team['latestTiming_' + race.category]
      }
    }

    $scope.saveEdits = function(team, race) {
      DBService.db.get(team._id)
        .then(function(t) {
          t['latestTiming_' + race.category] = parseFloat(team.edit.time);
          return DBService.db.put(t);
        })
        .then(function() {
          $scope.$apply(team['latestTiming_' + race.category] = parseFloat(team.edit.time));
          $scope.$apply(delete team.edit);
        })
        .catch(function(err) {
          alert(err);
          console.log(err);
        });
    }

    $scope.addComments = function(race) {
      var dialog = $modal.open({
        templateUrl: 'views/_partials.comments.html',
        controller: 'CommentsCtrl',
        size: 'sm',
        resolve: {
          comments: function() {
            return race.comments;
          }
        }
      });

      dialog.result.then(function(r) {
        DBService.db.get(race._id)
          .then(function(nrace) {
            nrace.comments = r.comments;
            return DBService.db.put(nrace);
          })
          .then(function(nr) {
            race._rev = nr.rev;
            race.comments = r.comments;
          })
          .catch(function(err) {
            console.log(err);
          })
      })

    }

    $scope.penalizeTime = function(team, race) {

      var confirmationDialog = $modal.open({
        templateUrl: 'views/_partials.timepenalty.html',
        controller: 'ConfirmationCtrl',
        size: 'sm'
      });

      confirmationDialog.result.then(function(r) {
        DBService.db.get(team._id)
          .then(function(t) {
            t.categories[race.category][race.round].penalty = {
              time: r.time,
              reason: r.reason
            };
            t['latestTiming_' + race.category] += r.time;
            return DBService.db.put(t);
          })
          .then(function(z) {
            console.log(team);
            team._rev = z.rev;
            $scope.$apply(team['latestTiming_' + race.category] += r.time);
            $scope.$apply(team.categories[race.category][race.round].penalty = {
              time: r.time,
              reason: r.reason
            });
          })
          .catch(function(err) {
            console.log(err);
          });
      });
    }

    $scope.disqualifyTeam = function(team, race, dns) {

      var confirmationDialog = $modal.open({
        templateUrl: 'views/_partials.confirmation.html',
        controller: 'ConfirmationCtrl',
        size: 'sm'
      });

      confirmationDialog.result.then(function(r) {
        if (r) {
          DBService.db.get(team._id)
            .then(function(t) {
              if (dns) {
                t.categories[race.category].dns = true;
              }
              t.categories[race.category].disqualified = true;
              return DBService.db.put(t);
            })
            .then(function(r) {
              team._rev = r.rev;
              if (dns) {
                $scope.$apply(team.categories[race.category].dns = true);
              }
              $scope.$apply(team.categories[race.category].disqualified = true);
            })
            .catch(function(err) {
              console.log(err);
            });
        }
      });
    }

    $scope.printRace = function(race, catName, isConfirmed) {
      var pdf = new jsPDF('landscape', 'pt', 'a4');

      var header = function(x, y, width, height, key, value, settings) {
        pdf.setFillColor(230, 230, 230); // Asphalt
        pdf.setTextColor(0, 0, 0);
        pdf.setFontStyle('bold');
        pdf.rect(x, y, width, height, 'F');
        y += settings.lineHeight / 2 + pdf.internal.getLineHeight() / 2 - 2.5;
        pdf.text('' + value, x + settings.padding, y);
      }

      //prevent dies from older ones without timing
      if (!race.hasOwnProperty('completedAt')) {
        race.completedAt = Date.now();
      }

      var columns = [{
        title: "Lane No",
        key: "lane"
      }, {
        title: "Boat",
        key: "boat"
      }, {
        title: "Team",
        key: "name",
        width: 450
      }, {
        title: "Position",
        key: "position"
      }, {
        title: "Time",
        key: "time"
      }];

      var data = [];

      var comments = [];

      if (race.hasOwnProperty('timeTrialTeams')) {
        _.forEach(race.timeTrialTeams, function(tt) {
          race[tt.laneKey] = tt.team;
        });
      }


      if (race.hasOwnProperty('withdrawn')) {
        _.forEach(race.withdrawn, function(tt) {
          race[tt.laneKey] = tt.team;
        });
      }


      DBService.getRaceTeams(race)
        .then(function(t) {

          var teams = _.map(t.rows, function(team) {
            return team.doc;
          });

          var sortedRaceTeams = _.sortBy(teams, function(team) {

            if (team.categories[race.category].disqualified) {
              return 99999999999;
            }

            if (race.confirmed) {
              return team.categories[race.category][race.round].time
            } else {
              return team["latestTiming_" + race.category];
            }
          });

          _.forEach(teams, function(team) {

            var pos = _.findIndex(sortedRaceTeams, {
              'teamID': team.teamID
            }) + 1;
            var label = "";

            if (race.hasOwnProperty('timeTrialTeams')) {

              if (_.find(race.timeTrialTeams, {
                  'team': team.teamID
                })) {
                //is a time trial team
                if (race.confirmed) {
                  label = "(COMPLETED TIMETRIAL)";
                } else {
                  pos = "TIMETRIAL"
                }
              }
            }

            var time = 0;

            if (race.completed) {
              if (team.categories[race.category].withdrawn) {
                time = "";
              } else if (race.confirmed) {
                time = team.categories[race.category][race.round].time.toFixed(3);
                time = parseFloat(time);

              } else {
                time = team["latestTiming_" + race.category].toFixed(3);
                time = parseFloat(time);

              }

            } else {
              time = "";
            }

            if (typeof time === 'number') {
              var minute = Math.floor(time / 60);

              var second = time - (minute * 60);

              if (minute > 0) {
                if (second < 10) {
                  time = minute + '.0' + second.toFixed(3);
                } else {
                  time = minute + '.' + second.toFixed(3);
                }
              } else {
                if (second < 10) {
                  time = '0.0' + second.toFixed(3);
                } else {
                  time = '0.' + second.toFixed(3);
                }
              }
            }

            if (team.categories[race.category].disqualified) {
              time = "";
            }

            var pt = "";

            if (race.completed) {
              if (team.categories[race.category].disqualified) {
                if (team.categories[race.category].withdrawn) {
                  pt = "WTH";
                } else if (team.categories[race.category].dns) {
                  pt = "DNS";
                } else {
                  pt = "DQ";
                }
              } else {
                pt = pos;
              }
            } else {
              pt = "";
            }

            if (team.categories[race.category][race.round]) {
              if (team.categories[race.category][race.round].penalty) {
                var p = team.categories[race.category][race.round].penalty;
                comments.push(team.name + " has been penalized " + p.time + " seconds due to: ");
                comments.push(" - " + p.reason);
                label = "(PENALIZED - See Remarks)";
              }

            }

            var d = {
              lane: $scope.getLane(team, race),
              boat: $scope.getLane(team, race),
              name: team.name + " " + label,
              position: pt,
              time: time
            }
            data.push(d);
          });
          if (race.comments) {
            comments.push(race.comments);
          }

          console.log(data);
          return DBService.db.getAttachment($scope.event._id, 'templateHeader.jpg')

        })
        .then(function(blob) {
          var reader = new FileReader();

          reader.onloadend = function() {
            var d = new Date(race.completedAt);
            var dn = new Date(Date.now());
            var img = reader.result;
            pdf.addImage(img, 'JPEG', 0, 5, 842, 155);
            pdf.setFontSize(12);
            pdf.text("Event No: " + race.raceID, 50, 175);
            pdf.text("Time: " + d.toTimeString(), 502, 175);
            pdf.text("Category: " + race.category + ' / ' + catName, 50, 195);
            pdf.text("Race Group: " + race.round + ' ' + (race.timeTrial ? 'TIMETRIAL ' : "") + race.roundNo, 50, 215);
            pdf.autoTable(columns, data, {
              fontSize: 15,
              lineHeight: 28,
              startY: 235,
              renderHeaderCell: header,
              avoidPageSplit: true
            });
            pdf.text("E-Signed By Chief Judge: " + $scope.event.chiefJudge, 50, pdf.autoTableEndPosY() + 30);
            pdf.text("E-Signed By Chief Official: " + $scope.event.chiefOfficial, 50, pdf.autoTableEndPosY() + 50);
            pdf.text("Time Posted: ", 50, pdf.autoTableEndPosY() + 70);

            console.log(comments);
            console.log(comments.length);

            if (comments[0]) {
              pdf.text("Remarks:", 300, pdf.autoTableEndPosY() + 30);
              pdf.text(comments, 300, pdf.autoTableEndPosY() + 44);
            }

            if (window.require) {
              var output = pdf.output('datauristring');
              var d = output.split(',')[1];
              var buffer = new Buffer(d, 'base64');
              var fs = require('fs');
              var path = require('path');
              var nwGui = require('nw.gui');
              var p = path.join($rootScope.settings.pdfoutputd, (race.raceID + '-' + race.category + '-' + race.round + '-' + (race.timeTrial ? 'TIMETRIAL-' : '') + race.roundNo + (race.confirmed ? '.pdf' : 'unconfirmed' + '.pdf')));
              console.log(p);
              fs.writeFileSync(p, buffer);
              try {
                nwGui.Shell.openItem(p);
              } catch (err) {
                console.log(err);
                alert(err);
              }
            } else {
              pdf.save(race.category + '-' + race.round + '-' + race.roundNo + '.pdf');
            }
          }

          reader.readAsDataURL(blob);
        })
        .catch(function(err) {
          alert(err);
          console.log(err);
        });


    }

    $scope.withdrawTeam = function(team, race) {
      var confirmationDialog = $modal.open({
        templateUrl: 'views/_partials.confirmation.html',
        controller: 'ConfirmationCtrl',
        size: 'sm'
      });

      confirmationDialog.result.then(function(r) {
        if (r) {

          var toRemove = _.findKey(race, function(value, key) {
            if (key.includes('LANE')) {
              return value === team.teamID;
            }
          });

          DBService.db.get($scope.event._id)
            .then(function(e) {
              if (e.activeRace === race._id) {
                alert("This race is currently active!");
                throw new Error("Current Active");
              } else {
                return DBService.db.get(race._id);
              }

            })
            .then(function(r) {

              //removes team from
              delete r[toRemove];

              var wt = {
                laneKey: toRemove,
                team: team.teamID
              };

              if (r.withdrawn) {
                r.withdrawn.push(wt);
              } else {
                r.withdrawn = [wt];
              }

              return DBService.db.put(r);
            })
            .then(function(r) {
              race._rev = r.rev;
              return DBService.db.get(team._id);
            })
            .then(function(t) {
              t.categories[race.category].withdrawn = true;
              t.categories[race.category].disqualified = true;
              return DBService.db.put(t);
            })
            .then(function(r) {
              team._rev = r.rev;
              $scope.$apply(_.remove(race.teams, function(t) {
                return t.teamID === team.teamID;
              }));
              $scope.$apply(team.categories[race.category].disqualified = true);
            })
            .catch(function(err) {
              console.log(err);
              loadAll();
            });
        }
      });

    };

    $scope.isTTComplete = function(timeTrialTeams) {

      var complete = true;

      _.forEach(timeTrialTeams, function(t) {
        if (!t.hasOwnProperty('complete')) {
          complete = false;
        }
      });

      return complete;
    }

    $scope.timetrialTeam = function(team, race, event, round) {
      var confirmationDialog = $modal.open({
        templateUrl: 'views/_partials.confirmation.html',
        controller: 'ConfirmationCtrl',
        size: 'sm'
      });

      confirmationDialog.result.then(function(r) {
        if (r) {

          DBService.getAllTimeTrials(race.round, race.category, event.eventID)
            .then(function(r) {
              var races = _.map(r.rows, function(race) {
                return race.doc;
              });

              var sortedRaces = _.sortBy(races, 'roundNo');

              var laneKey = _.findKey(race, function(value, key) {
                if (key.includes('LANE')) {
                  return value === team.teamID;
                }
              });

              var available = {};

              _.forEach(sortedRaces, function(r) {
                if (!r.hasOwnProperty(laneKey)) {
                  //there's a lane available!
                  if (!r.hasOwnProperty('completed')) {
                    if (r._id !== $scope.event.activeRace) {

                      var isSame = true;

                      _.forEach(r, function(value, key) {
                        if (key.includes('LANE')) {
                          //each race in timetrial
                          if (race.hasOwnProperty('timeTrialTeams')) {
                            if (!(_.find(race.timeTrialTeams, {
                                'team': value
                              }))) {
                              isSame = false;
                            }
                          } else {
                            //there are LANEs and I havent even sent anyone to TT
                            //this is definitely not from my lane
                            isSame = false;
                          }
                        }
                      })

                      if (isSame) {
                        available = r;
                        return false;

                      }
                    }
                  }
                }
              });

              if (available.hasOwnProperty('roundNo')) {
                available[laneKey] = team.teamID;

                DBService.db.put(available)
                  .then(function() {
                    return DBService.db.get(race._id);
                  })
                  .then(function(r) {
                    delete r[laneKey];
                    if (r.hasOwnProperty('timeTrialTeams')) {
                      r.timeTrialTeams.push({
                        laneKey: laneKey,
                        team: team.teamID,
                        race: available._id,
                        roundNo: available.roundNo,
                        originalTime: team["latestTiming_" + race.category]
                      });
                    } else {
                      r.timeTrialTeams = [{
                        laneKey: laneKey,
                        team: team.teamID,
                        race: available._id,
                        roundNo: available.roundNo,
                        originalTime: team["latestTiming_" + race.category]
                      }];
                    }

                    return DBService.db.put(r);
                  })
                  .then(function(re) {
                    $scope.reload();
                  });
              } else {

                var opts = {
                  round: race.round,
                  category: race.category,
                  roundNo: sortedRaces.length + 1,
                  timeTrial: true
                };

                opts[laneKey] = team.teamID
                var newID = "";

                DBService.createTimeTrial(opts, event.eventID)
                  .then(function(r) {
                    newID = r.id;
                    return DBService.db.get(event._id);
                  })
                  .then(function(event) {
                    if (event.hasOwnProperty('scheduleErrors')) {

                      event.scheduleErrors.push({
                        type: 404,
                        category: race.category,
                        round: race.round,
                        roundNo: 'timetrial_' + opts.roundNo,
                      });

                    } else {
                      event.scheduleErrors = [{
                        type: 404,
                        category: race.category,
                        round: race.round,
                        roundNo: 'timetrial_' + opts.roundNo
                      }];
                    }

                    return DBService.db.put(event);
                  })
                  .then(function() {
                    return DBService.db.get(race._id);
                  })
                  .then(function(r) {
                    delete r[laneKey];
                    if (r.hasOwnProperty('timeTrialTeams')) {
                      r.timeTrialTeams.push({
                        laneKey: laneKey,
                        team: team.teamID,
                        race: newID,
                        roundNo: 'timetrial_' + opts.roundNo,
                        originalTime: team["latestTiming_" + race.category]
                      });
                    } else {
                      r.timeTrialTeams = [{
                        laneKey: laneKey,
                        team: team.teamID,
                        race: newID,
                        roundNo: 'timetrial_' + opts.roundNo,
                        originalTime: team["latestTiming_" + race.category]
                      }];
                    }

                    return DBService.db.put(r);
                  })
                  .then(function(re) {
                    $scope.reload();
                  });
              }

            })

        }
      });
    }

    var loadAll = function() {
      DBService.setActiveEvent($routeParams.eventID);
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

    $scope.unconfirmRace = function(race) {
      DBService.db.get(race._id)
        .then(function(r) {
          r.confirmed = false;
          return DBService.db.put(r);
        })
        .then(function() {
          loadAll();
        })
        .catch(function(err) {
          alert(err);
          console.log(err);
        })
    }

    $scope.confirmRace = function(race) {

      //TBD!

      if (race.timeTrial) {
        DBService.getAllRacesOfRound(race.category, race.round)
          .then(function(r) {
            var races = _.map(r.rows, function(race) {
              return race.doc;
            });

            var toBeUpdated = [];

            _.forEach(races, function(r) {
              if (r.hasOwnProperty('timeTrialTeams')) {
                _.forEach(r.timeTrialTeams, function(timeT) {
                  if (timeT.race === race._id) {
                    timeT.complete = true;
                    toBeUpdated.push(r);
                  }
                });
              }
            });

            return DBService.db.bulkDocs(toBeUpdated);
          })
          .then(function() {
            return DBService.db.get(race._id);
          })
          .then(function(r) {
            r.confirmed = true;
            return DBService.db.put(r);
          })
          .then(function() {
            loadAll();
          })
      } else {

        var err;
        var raceWinner = 0;

        if (race.hasOwnProperty('timeTrialTeams')) {
          _.forEach(race.timeTrialTeams, function(tt) {
            race[tt.laneKey] = tt.team;
          });
        }

        DBService.getRaceTeams(race)
          .then(function(t) {
            console.log(t);
            var teams = _.map(t.rows, function(team) {
              var cat = team.doc.categories[race.category];

              if (team.doc["latestTiming_" + race.category] && (team.doc["latestTiming_" + race.category] < 5000)) {
                cat[race.round].time = team.doc["latestTiming_" + race.category];
              } else {
                if (team.doc.categories[race.category].withdrawn) {
                  //team is actually withdrawn
                  cat[race.round].time = 9999.99;
                } else {
                  alert("Race timing for " + team.doc.name + " is invalid. Please double check the race timings.");
                  throw new Error('Race timing not found!');
                }
              }

              //in case this wasnt actually saved
              cat[race.round].roundNo = race.roundNo;
              return team.doc;
            });

            console.log(teams);
            //set the race winner
            var s = _.sortBy(teams, 'latestTiming_' + race.category);

            var i = 0;
            while (s[i].categories[race.category].hasOwnProperty('disqualified')) {
              i++;
            }
            raceWinner = s[i].teamID;

            var winningTeam = _.find(teams, {
              'teamID': raceWinner
            });
            //var c = winningTeam.categories[race.category];
            //c[race.round].winner = true;

            console.log("winner is");
            console.log(winningTeam);

            console.log(teams);

            return DBService.db.bulkDocs(teams);
          })
          .then(function(r) {

            console.log("updated teams with results");
            console.log(r);

            DBService.db.get(race._id)
              .then(function(r) {
                r.winner = raceWinner;
                r.confirmed = true;
                return DBService.db.put(r);
              })
              .then(function() {
                return DBService.getAllRacesOfRound(race.category, race.round)
              })
              .then(function(r) {
                var races = _.map(r.rows, function(race) {
                  return race.doc;
                });
                if (_.every(races, {
                    'confirmed': true
                  })) {
                  //everyone is confirmed yay
                  $scope.$apply($location.path("/event/nextround/" + race._id));
                  $location.path("/event/nextround/" + race._id);
                } else {
                  loadAll();
                }
              })
              .catch(function(err) {
                console.log(err);
              })
          })
          .catch(function(err) {
            console.log(err);
          });

      }



    };


    loadAll();
  })
  .controller('ConfirmationCtrl', function($scope, $modalInstance) {

    $scope.time = 0;
    $scope.reason = "";

    $scope.ok = function() {
      $modalInstance.close({
        time: $scope.time,
        reason: $scope.reason,
        comments: $scope.comments
      });
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  })
  .controller('CommentsCtrl', function($scope, $modalInstance, comments) {
    $scope.comments = comments;
    $scope.ok = function() {
      $modalInstance.close({
        comments: $scope.comments
      });
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };

  });
