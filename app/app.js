
/******************************************************************************
██ ███    ███ ██████   ██████  ██████  ████████ ███████
██ ████  ████ ██   ██ ██    ██ ██   ██    ██    ██
██ ██ ████ ██ ██████  ██    ██ ██████     ██    ███████
██ ██  ██  ██ ██      ██    ██ ██   ██    ██         ██
██ ██      ██ ██       ██████  ██   ██    ██    ███████
******************************************************************************/
var express = require('express');
var app = express();

var config = require("config");
var xpath = require('xpath');
var async = require('async');
var assert = require('assert');
var _ = require("underscore");

var ccb = require("./ccb");
var CCB = new ccb();

var mongo = require('mongodb').MongoClient;


/******************************************************************************
██████   █████  ████████  █████  ██████   █████  ███████ ███████
██   ██ ██   ██    ██    ██   ██ ██   ██ ██   ██ ██      ██
██   ██ ███████    ██    ███████ ██████  ███████ ███████ █████
██   ██ ██   ██    ██    ██   ██ ██   ██ ██   ██      ██ ██
██████  ██   ██    ██    ██   ██ ██████  ██   ██ ███████ ███████
******************************************************************************/
var db = null;
// Use connect method to connect to the server
mongo.connect('mongodb://mongo:27017/attendance', function(err, db) {
  assert.equal(null, err);
  db = this.db;
  console.log("Connected succesfully to the MongoDB server");
  //console.log(db);
});

// do app specific cleaning before exiting
process.on('exit', function () {
  if (db != null) {
    console.log("Closing app");
    db.close();
  }
});

/******************************************************************************
 █████  ██████  ██     ███████ ████████  █████  ████████ ██    ██ ███████
██   ██ ██   ██ ██     ██         ██    ██   ██    ██    ██    ██ ██
███████ ██████  ██     ███████    ██    ███████    ██    ██    ██ ███████
██   ██ ██      ██          ██    ██    ██   ██    ██    ██    ██      ██
██   ██ ██      ██     ███████    ██    ██   ██    ██     ██████  ███████
******************************************************************************/
app.get('/ccb_api_status', function (req, res) {
  CCB.api_status(function (doc) {
    res.send({
      status: "online",
      daily_counter: xpath.select('//counter/text()', doc).toString()
    });
  }).on('error', function (err) {
    res.send({
      status: "error",
      error_message: err.toString()
    });
  });
});

app.get('/', function (req, res) {
  res.send('Hello World!');
});
app.listen(config.get('port'), function () {
  console.log("Example app listening on port "+config.get('port')+"!");
});


async.parallel({
  group_profiles: function(callback) {
    CCB.api_paged("group_profiles", function (doc) {
      _.each(xpath.select('//response/group', doc), function (node) {
        if (xpath.select('department')[0].attrib('id') == config.get('CCB.constants.department_id')) {
          console.log(db.collection('inserts').insertOne({group:{
            id:node.attrib('id'),
            xml:node.xml()
          }}));
        }
      });

      console.log(doc.toString());
      callback(null, doc);
    }, {include_participants: false}, 3, 1).on('error', function(err){
      callback(err);
    });
    //callback(null, null);
  }, event_profiles: function(callback) {
    callback(null, null);
    /*
    CCB.api("event_profiles", function (doc) {
      //console.log(doc.toString());
      callback(null, doc);
    }).on('error', function(err){
      callback(err);
    });*/
  }, process_list: function(callback) {
    callback(null, null);
    /*
    CCB.api("process_list", function (doc) {
      //console.log(doc.toString());
      callback(null, doc);
    }).on('error', function(err){
      callback(err);
    });*/
  }
}, function (err, result) {
  if (err) {
    console.log("Errors:" + err);
  }
  console.log(result);
});


/*
async.waterfall([
  function getDepartmentID(data, callback) {
    CCB.department_id('EV Youth', function (err, id) {
      data.department_id = id;
      callback(null, data);
    }).on('error', function(err){
      callback(err);
    });
  },
  function async.parallel({
    CCB.api_paged("group_profiles", function (doc) {
      //console.log(doc.toString());
      data.group_profiles_xml = doc;
      callback(null, data);
    }, {include_participants: false}).on('error', function(err){
      callback(err);
    });
  },
  function eventProfiles(data, callback) {
    CCB.api_paged("event_profiles", function (doc) {
      //console.log(doc.toString());
      data.event_profiles_xml = doc;
      callback(null, data);
    }, {include_participants: false}).on('error', function(err){
      callback(err);
    });
  },
  function eventProfiles(data, callback) {
    CCB.api_paged("process_list", function (doc) {
      //console.log(doc.toString());
      data.process_list_xml = doc;
      callback(null, data);
    }, {include_participants: false}).on('error', function(err){
      callback(err);
    });
  }


], function (err, result) {
    console.log(err);
    console.log(result);
})

*/
