var express = require('express')
var app = express();
var os = require('os');

app.set('port', (process.env.PORT || 7777))
app.use(express.static(__dirname + '/public'))

app.get('/', function(request, response) {
  response.send("Hello World from: " + os.hostname())
})

app.listen(app.get('port'), function() {
  console.log("Node app is running at port: " + app.get('port'))
})