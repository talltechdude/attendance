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
              DB.collection('groups').insertOne({
                id:node.getAttribute('id').toString(),
                name:xpath.select('name', node)[0].childNodes[0].nodeValue.toString(),
                department:xpath.select('department', node)[0].childNodes[0].nodeValue.toString(),
                xml:node.toString()
              });
            }
          });
          callback();
        }, args, 100, 6).on('error', function(err){
          return callback(err);
        });
      }
    ], function (err) {
      if (err) console.log(err);
      callback();
    });
    return self;
  };

  this.list_groups = function(callback) {
    self.DB.collection('groups').find({}).each(function(err, doc) {
      assert.equal(err, null);
      if (doc != null) {
        console.log("Group:");
        console.dir(doc);
      } else {
        callback();
      }
    });
  };

  this.last_updated = function(callback) {
    self.DB.collection('lastupdate').find({}).each(function(err, doc) {
      assert.equal(err, null);
      if (doc != null) {
        console.log("Last updated:");
        console.dir(doc);
      } else {
        callback();
      }
    });
  };

  this.connect = function(callback) {
    // Use connect method to connect to the server
    mongo.connect('mongodb://mongo:27017/attendance', function(err, db) {
      assert.equal(null, err);
      self.DB = db;
      console.log("Connected succesfully to the MongoDB server");
      callback();
    });
  };

  this.close = function(callback) {
    if (self.DB) {
      self.DB.close();
    }
    callback();
  }

  return this;
};

util.inherits(exports.database, events.EventEmitter);
