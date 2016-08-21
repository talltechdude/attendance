var express = require('express');
var app = express();

var config = require("config");
var xpath = require('xpath');
var async = require('async');

var ccb = require("./ccb");
var CCB = new ccb();

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

async.waterfall([
  function getDepartmentID(callback) {
    CCB.department_id('EV Youth', function (err, id) {
      callback(null, {department_id: id});
    }).on('error', function(err){
      callback(err);
    });
  },
  function listGroups(data, callback) {
    CCB.api_paged("group_profiles", function (doc) {
      //console.log(doc.toString());
      data.group_profiles_xml = doc;
      callback(null, data);
    }, {include_participants: false}).on('error', function(err){
      callback(err);
    });
  }
  

], function (err, result) {
    console.log(err);
    console.log(result);
})
