var express = require('express');
var app = express();

var config = require("config");

app.get('/', function (req, res) {
  res.send('Hello World!');
});
console.log("Example app listening on port "+config.get('port')+"!");
app.listen(config.get('port'), function () {
  console.log("Example app listening on port "+config.get('port')+"!");
});
