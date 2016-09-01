/******************************************************************************
 ██████  ██████ ██████      ███████ ██    ██ ███    ██  ██████
██      ██      ██   ██     ██       ██  ██  ████   ██ ██
██      ██      ██████      ███████   ████   ██ ██  ██ ██
██      ██      ██   ██          ██    ██    ██  ██ ██ ██
 ██████  ██████ ██████      ███████    ██    ██   ████  ██████
******************************************************************************/
var events = require('events');
var util = require('util');
var config = require("config");
var dom = require('xmldom').DOMParser
var xpath = require('xpath');
var _ = require("underscore");
var assert = require('assert');
var async = require('async');
var moment = require('moment');
var mongo = require('mongodb').MongoClient;

exports.database = function database(_CCB) {
  var self = this;
  self.DB = null;
  self.CCB = _CCB;
  events.EventEmitter.call(this);

  /*
   ██████ ██      ███████  █████  ██████       ██████  ██████   ██████  ██    ██ ██████  ███████
  ██      ██      ██      ██   ██ ██   ██     ██       ██   ██ ██    ██ ██    ██ ██   ██ ██
  ██      ██      █████   ███████ ██████      ██   ███ ██████  ██    ██ ██    ██ ██████  ███████
  ██      ██      ██      ██   ██ ██   ██     ██    ██ ██   ██ ██    ██ ██    ██ ██           ██
   ██████ ███████ ███████ ██   ██ ██   ██      ██████  ██   ██  ██████   ██████  ██      ███████
  */
  this.clear_groups = function(callback) {
    async.series([
      function (callback) {
        self.DB.collection('groups').drop().then(function() {
          callback();
        }, function() {
          callback();
        });
      },
      function (callback) {
        self.DB.collection('lastupdate').deleteOne({groups: {$exists:true}}).then(function(){
          callback();
        }, function() {
          callback();
        });
      }
    ],function (err) {
      if (err) console.log(err);
      console.log("Cleared groups");
      callback();
    });
    return this;
  };
  /*
  ███████ ██    ██ ███    ██  ██████      ██████  ██████   ██████  ██    ██ ██████  ███████
  ██       ██  ██  ████   ██ ██          ██       ██   ██ ██    ██ ██    ██ ██   ██ ██
  ███████   ████   ██ ██  ██ ██          ██   ███ ██████  ██    ██ ██    ██ ██████  ███████
       ██    ██    ██  ██ ██ ██          ██    ██ ██   ██ ██    ██ ██    ██ ██           ██
  ███████    ██    ██   ████  ██████      ██████  ██   ██  ██████   ██████  ██      ███████
  */
  this.sync_groups = function(callback) {
    var CCB = self.CCB;
    var DB = self.DB;
    var lastUpdate;
    console.log("Beginning group sync...");
    async.series([
      function (callback) {
        console.log("Finding last updated date");
        DB.collection('lastupdate').findOne({groups: {$exists:true}}).then(function (res){
          if (res) {
            lastUpdate = res.groups;
          }
          console.log("Finding last update date [done]");
          callback();
        });
      },
      function (callback) {
        console.log("Reading modified groups");
        var args = {include_participants: false};
        if (lastUpdate) {
          args.modified_since = lastUpdate;
        }
        DB.collection('lastupdate').updateOne({groups: {$exists:true}}, {$set:{groups:moment().subtract(1, 'days').format('YYYY-MM-DD')}},{upsert:true});
        console.log("Loading XML data...");
        CCB.api_paged("group_profiles", function (doc) {
          //console.log(doc.toString());
          _.each(xpath.select('//response/groups/group', doc), function (node) {
            //console.log("Group Department: "+xpath.select('department', node)[0].getAttribute('id')+"=="+config.get('CCB.constants.department_id')+" (inactive:"+util.inspect(xpath.select('inactive', node)[0].childNodes[0].nodeValue)+")");
            if (xpath.select('inactive', node)[0].childNodes[0].nodeValue === 'false' && xpath.select('department', node)[0].getAttribute('id') == config.get('CCB.constants.department_id')) {
              //console.log("Group Department:"+xpath.select('department', node)[0].getAttribute('id')+" (inactive:"+util.inspect(xpath.select('inactive', node)[0].childNodes[0].nodeValue)+")");
              DB.collection('groups').updateOne({id:CCB.node_attribute('.', 'id', node)}, {
                id:CCB.node_attribute('.', 'id', node),
                name:CCB.node_text('name', node),
                description: CCB.node_text('description', node),
                department:{id:CCB.node_attribute('department', 'id', node), name:CCB.node_text('department', node)},
                mainleader:{id:CCB.node_attribute('main_leader', 'id', node), name:CCB.node_text('main_leader/full_name', node), email:CCB.node_text('main_leader/email', node)},
                director:{id:CCB.node_attribute('director', 'id', node), name:CCB.node_text('director/full_name', node), email:CCB.node_text('director/email', node)},
                modified:{date:CCB.node_text('modified', node), by:{id:CCB.node_attribute('modifier', 'id', node), name:CCB.node_text('modifier', node)}},
                xml:node.toString()
              }, {upsert: true});
            }
          });
          callback();
        }, args, 100, 6).on('error', function(err){
          return callback(err);
        });
      },
      function (callback) {
        var q = async.queue(function(group, callback){
          console.log("Loading participants of group "+group.name+" ("+group.id+")");
          var args = {id:group.id};
          if (lastUpdate && group.participants && group.participants.length > 0) {
            args.modified_since = lastUpdate;
          } else {
            group.participants = [];
            group.leaders = [];
          }

          CCB.api("group_participants", function(doc) {
            //console.log(doc.toString());
            //console.log(CCB.node_attribute('//groups/group/participants', 'count', doc));
            if (parseInt(CCB.node_attribute('//groups/group/participants', 'count', doc)) > 0) {
              group.participants = [];
              group.leaders = [];
              _.each(xpath.select('//groups/group/participants/participant', doc), function (node) {
                //console.log(CCB.node_text('name', node));
                group.participants.push({id:CCB.node_attribute('.', 'id',node),
                  name:CCB.node_text('name', node),
                  status:{id:CCB.node_attribute('status', 'id', node), value:CCB.node_text('status', node)}
                });
                if (CCB.node_attribute('status', 'id', node) === '1') { //Group Leaders
                  group.leaders.push({id:CCB.node_attribute('.', 'id',node),
                    name:CCB.node_text('name', node),
                    email:CCB.node_text('email', node),
                    status:{id:CCB.node_attribute('status', 'id', node), value:CCB.node_text('status', node)}
                  });
                }
              });
              DB.collection('groups').updateOne({id:group.id}, { $set : {participants: group.participants, leaders: group.leaders}}).then(function() {
                callback();
              }, function(err) {
                console.log("Error: "+err);
                callback();
              });
            } else {
              callback();
            }
          }, args);
        }, 4);
        q.drain = callback;

        DB.collection('groups').find({}, {_id:0, xml:0}).each(function(err, group){
          assert.equal(err, null);
          if (group != null && group.id != 1533) {
            q.push(group, function(){});
          }
        });
      }
    ], function (err) {
      if (err) console.log(err);
      callback();
    });
    return self;
  };

  this.sync_queues = function(callback) {
    var CCB = self.CCB;
    var DB = self.DB;
    var lastUpdate;
    console.log("Beginning process queue sync...");
    async.series([
      function (callback) {
        console.log("Finding last updated date");
        DB.collection('lastupdate').findOne({queues: {$exists:true}}).then(function (res){
          if (res) {
            lastUpdate = res.groups;
          }
          console.log("Finding last update date [done]");
          callback();
        });
      },
      function (callback) {
        console.log("Fetching process list");
        CCB.api("process_list", function (doc) {
          console.log(doc.toString());
          _.each(xpath.select('//processes/process', doc), function (node) {
            //console.log(node.toString());
            //console.log(CCB.node_text('name', node));
            if (CCB.node_text('name', node).match(/^Yr (\d+) (Boys|Girls)/)) {
              console.log("Processing "+CCB.node_text('name', node));
              var qNew = CCB.node_attribute('queues/queue[text()="New at EV Youth"]', 'id', node);
              console.log("New at EV Youth Q: "+qNew);



            }
          });
          console.log("Done");
          callback();
        });
      }
    ]);
    callback();
  };

  /*
  ██████  ██████  ██ ███    ██ ████████      ██████  ██████   ██████  ██    ██ ██████  ███████
  ██   ██ ██   ██ ██ ████   ██    ██        ██       ██   ██ ██    ██ ██    ██ ██   ██ ██
  ██████  ██████  ██ ██ ██  ██    ██        ██   ███ ██████  ██    ██ ██    ██ ██████  ███████
  ██      ██   ██ ██ ██  ██ ██    ██        ██    ██ ██   ██ ██    ██ ██    ██ ██           ██
  ██      ██   ██ ██ ██   ████    ██         ██████  ██   ██  ██████   ██████  ██      ███████
  */
  this.print_groups = function(callback) {
    self.DB.collection('groups').find({}, {_id:0, xml:0}).each(function(err, group) {
      assert.equal(err, null);
      if (group != null) {
        console.log("Group: "+group.name+" ("+group.id+")");
        //console.log(JSON.stringify(group));
        //console.dir(group);
      } else {
        callback();
      }
    });
  };

  /*
  ██      ██ ███████ ████████      ██████  ██████   ██████  ██    ██ ██████  ███████
  ██      ██ ██         ██        ██       ██   ██ ██    ██ ██    ██ ██   ██ ██
  ██      ██ ███████    ██        ██   ███ ██████  ██    ██ ██    ██ ██████  ███████
  ██      ██      ██    ██        ██    ██ ██   ██ ██    ██ ██    ██ ██           ██
  ███████ ██ ███████    ██         ██████  ██   ██  ██████   ██████  ██      ███████
  */
  this.list_groups = function(callback) {
    var groups = [];
    self.DB.collection('groups').find({}, {_id:0, xml:0}).each(function(err, group) {
      assert.equal(err, null);
      if (group != null) {
        groups.push(group);
        //console.log("Group: "+group.name+" ("+group.id+")");
        //console.log(JSON.stringify(group));
        //console.dir(group);
      } else {
        callback(groups);
      }
    });
  };

  this.list_group_participants = function(id, callback) {
    self.DB.collection('groups').findOne({id:id}, {participants:1}).then(function(group) {
      if (group != null) {
        callback(group.participants);
        //console.log("Group: "+group.name+" ("+group.id+")");
        //console.log(JSON.stringify(group));
        //console.dir(group);
      } else {
        callback(null);
      }
    });
  };

  this.list_leaders = function(id, callback) {
    self.DB.collection('groups').findOne({id:id}, {leaders:1}).then(function(group) {
      if (group != null) {
        callback(group.leaders);
      } else {
        callback(null);
      }
    });
  };
  /*
  ██      ██ ███████ ████████     ██       █████  ███████ ████████     ██    ██ ██████  ██████   █████  ████████ ███████ ██████      ██████   █████  ████████ ███████ ███████
  ██      ██ ██         ██        ██      ██   ██ ██         ██        ██    ██ ██   ██ ██   ██ ██   ██    ██    ██      ██   ██     ██   ██ ██   ██    ██    ██      ██
  ██      ██ ███████    ██        ██      ███████ ███████    ██        ██    ██ ██████  ██   ██ ███████    ██    █████   ██   ██     ██   ██ ███████    ██    █████   ███████
  ██      ██      ██    ██        ██      ██   ██      ██    ██        ██    ██ ██      ██   ██ ██   ██    ██    ██      ██   ██     ██   ██ ██   ██    ██    ██           ██
  ███████ ██ ███████    ██        ███████ ██   ██ ███████    ██         ██████  ██      ██████  ██   ██    ██    ███████ ██████      ██████  ██   ██    ██    ███████ ███████
  */
  this.last_updated = function(callback) {
    self.DB.collection('lastupdate').find({}).each(function(err, doc) {
      assert.equal(err, null);
      if (doc != null) {
        console.log("Groups last updated: "+doc.groups);
        //console.dir(doc);
      } else {
        callback();
      }
    });
  };

  /*
   ██████  ██████  ███    ██ ███    ██ ███████  ██████ ████████
  ██      ██    ██ ████   ██ ████   ██ ██      ██         ██
  ██      ██    ██ ██ ██  ██ ██ ██  ██ █████   ██         ██
  ██      ██    ██ ██  ██ ██ ██  ██ ██ ██      ██         ██
   ██████  ██████  ██   ████ ██   ████ ███████  ██████    ██
  */
  this.connect = function(callback) {
    // Use connect method to connect to the server
    mongo.connect('mongodb://mongo:27017/attendance', function(err, db) {
      assert.equal(null, err);
      self.DB = db;
      console.log("Connected succesfully to the MongoDB server");
      callback();
    });
  };
  /*
   ██████ ██       ██████  ███████ ███████
  ██      ██      ██    ██ ██      ██
  ██      ██      ██    ██ ███████ █████
  ██      ██      ██    ██      ██ ██
   ██████ ███████  ██████  ███████ ███████
  */
  this.close = function(callback) {
    if (self.DB) {
      self.DB.close();
    }
    callback();
  }

  return this;
};

util.inherits(exports.database, events.EventEmitter);
