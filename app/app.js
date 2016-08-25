var express = require('express');
var app = express();

var config = require("config");
var xpath = require('xpath');
var async = require('async');

var ccb = require("./ccb");
var CCB = new ccb();

var MongoClient = require('mongodb').MongoClient;


//CCB.api_status(function(doc) {
//  console.log(xpath.select('//counter/text()', doc).toString());
//});

//CCB.group_grouping_list(function($) {
//  console.log($('item name'));
  //console.log(response);
//});

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
    /*
    CCB.api_paged("group_profiles", function (doc) {
      console.log(doc.toString());
      callback(null, doc);
    }, {include_participants: false}).on('error', function(err){
      callback(err);
    });
    */
    callback(null, null);
  }, event_profiles: function(callback) {
    CCB.api("event_profiles", function (doc) {
      console.log(doc.toString());
      callback(null, doc);
    }).on('error', function(err){
      callback(err);
    });
  }, process_list: function(callback) {
    CCB.api("process_list", function (doc) {
      console.log(doc.toString());
      callback(null, doc);
    }).on('error', function(err){
      callback(err);
    });
  }
}, function (err, result) {
  if (err) {
    console.log("Errors:" + err);
  }
  console.log(result);
});


// Connection URL
var url = 'mongodb://mongo:27017/attendance';

// Use connect method to connect to the server
MongoClient.connect(url, function(err, db) {
  if (!err) {
    console.log("Connected succesfully to server");
    console.log(db);
  }
  db.close();
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
