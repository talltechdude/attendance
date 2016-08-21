var Client = require('node-rest-client').Client;
var config = require("config");

var dom = require('xmldom').DOMParser
var events = require('events');
var util = require("util");
var xpath = require('xpath');
const querystring = require('querystring');
var _ = require("underscore");

var client = new Client({
  user: config.get('CCB.username'),
  password: config.get('CCB.password'),
});

module.exports = CCB;

function CCB() {
    events.EventEmitter.call(this);
}

util.inherits(CCB, events.EventEmitter);

CCB.prototype.api_status = function(callback) {
  var self = this;
  client.get(config.get('CCB.baseurl')+"/api.php?srv=api_status", function (data, response) {
    callback(new dom().parseFromString(data.toString(),"text/xml"));
    //console.log(response);
  }).on('error', function (err) {
    console.error('Something went wrong on the request', err.toString());
    self.emit('error', err.toString());
  });
  return self;
};

CCB.prototype.api_group_grouping_list = function(callback) {
  var self = this;
  client.get(config.get('CCB.baseurl')+"/api.php?srv=group_grouping_list", function (data, response) {
    callback(new dom().parseFromString(data.toString(),"text/xml"));
  }).on('error', function (err) {
    console.error('Something went wrong on the request', err.toString());
    self.emit('error', err.toString());
  });
  return self;
};

CCB.prototype.api_group_profiles = function(callback, args) {
  var self = this;
  var url = config.get('CCB.baseurl')+"/api.php?srv=group_profiles";
  if (args) {
    url += "&"+querystring.stringify(args);
  }
  console.log(url);
  client.get(url, function (data, response) {
    callback(new dom().parseFromString(data.toString(),"text/xml"));
  }).on('error', function (err) {
    console.error('Something went wrong on the request', err.toString());
    self.emit('error', err.toString());
  });
  return self;
};

CCB.prototype.api_paged = function(srv, callback, args, num) {
  var self = this;
  var url = config.get('CCB.baseurl')+"/api.php?srv="+srv;
  if (args) {
    url += "&"+querystring.stringify(args);
  }
  if (!num) {
    num = 100;
  }
  var doc = null;

  function getPage(page) {
    client.get(url+"&per_page="+num+"&page="+page, function (data, response) {
      var docpart = new dom().parseFromString(data.toString(),"text/xml");
      //console.log(docpart.toString());
      console.log("Loaded page "+page);
      if (!doc) {
        doc = docpart;
      } else {
        var parent = xpath.select('//response/*[@count]', doc)[0];
        _.each(xpath.select('//response/*[@count]/*', docpart), function (node) {
          parent.appendChild(node);
        });
      }
      var count = xpath.select('//response/*[@count]', docpart)[0].getAttribute('count');
      console.log(count+" results on page "+page);
      if (count == num) {
        getPage(page + 1);
      } else {
        var total = xpath.select('//response/*[@count]/*', doc).length;
        xpath.select('//response/*[@count]', doc)[0].setAttribute('count', total);
        callback(doc);
      }
    }).on('error', function (err) {
      console.error('Something went wrong on the request', err.toString());
      self.emit('error', err.toString());
    });
  }
  getPage(1);
  return self;
}


CCB.prototype.department_id = function (name, callback) {
  var self = this;
  CCB.prototype.api_group_grouping_list(function (doc) {
    //console.log(doc.toString());
    var nodes = xpath.select('//items/item[name="'+name+'"]/id', doc);
    if (nodes) {
      callback(null, nodes[0].firstChild.data);
    }
  }).on('error', function(err) {
    callback(err.toString(), null);
    self.emit('error', err.toString());
  });
  return self;
}