var remoteHostName = "lucy.oblomov.com";
var defaultReaderServerPortNr = 8080;


var http     = require('http')
  , url      = require('url')
  , fs       = require('fs')
  , express  = require('express')  
  , _        = require('underscore')
  , Backbone = require('backbone')
  , child_pr = require('child_process') // for svn revision
  , path     = require('path')
  , util     = require('oblo-util')
  , net      = require('net')
  , rl       = require('readline')

  , socketIO = require('socket.io')
  , app;

var hostName, portNr;

if (process.argv[2] == 'remote') {
  hostName = remoteHostName;
  portNr   = process.argv[3] || defaultReaderServerPortNr;
} else {
  hostName = "localhost";
  portNr   = process.argv[2] || defaultReaderServerPortNr;
}


function initServer() {
  app = express();

  app.enable('trust proxy'); // Need this to get correct ip address when redirecting from lucy.oblomov.com

  app.use(express.compress());

  // serve 'client', 'shared', and 'node-modules' directories, but not 'server'
  app.use('/js/client', express.static(__dirname + '/../client'));
  app.use('/js/shared', express.static(__dirname + '/../shared'));
  app.use('/js/node_modules', express.static(__dirname + '/../node_modules'));
  app.use(express.static(__dirname + '/../../www')); // '/' serves 'www' directory

  //app.use(express.logger()); 
  app.use(function(req, res, next) { // logger only seems to report in GMT, so we log by hand
    var now = new Date();
    util.log('\nRQ: ' + util.showDate(now) + ' ' + util.showTime(now) + ' (' + req.ip + ', "' + req.headers['user-agent'].slice(0,20) + '..") path:' + req.path);
    next();
  });

  app.use(express.bodyParser()); 

  app.get('/query/version', function(req, res) {  
    child_pr.exec( "svnversion"
                 , {cwd: '../..'}
                 , function(error, stdout, stderr) { res.send('Revision '+stdout); } );
  });
  
  app.get('/query/tags', function(req, res) {  
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify(tagState));
  });

  app.get('/query/test', function(req, res) {  
    util.log('test');
    res.writeHead(204);
    res.end();
  });
}

initServer();

var server = http.createServer(app)
  , io = socketIO.listen(server);

io.set('log level', 1); // reduce logging
server.listen(8201);

connectReaderServer();

/* 
  io.sockets.on('connection', function (socket) {
  });
      //socket.on('my other event', function (data) {
    //  util.log(data);
    //});

 */

function connectReaderServer() {
  var readerServerSocket = new net.Socket();

  readerServerSocket.on('error', function(err) {
    util.log('Connection to reader server failed, retrying..', err.code);
  });
  var connectInterval = 
    setInterval(function() {
      util.log('Trying to connect to reader server on '+hostName+':'+portNr);
      readerServerSocket.connect(portNr, hostName);
     
      readerServerSocket.on('connect', function() {
        util.log('Connected to reader server');
        clearInterval(connectInterval);
        readerServerConnected(readerServerSocket);
      });
      }, 500);
}

function readerServerConnected(readerServerSocket) {
  util.log('Connected to reader server at: ' + hostName + ':' + portNr);
/*
    var fileStream = fs.createWriteStream('calibratie/Output-'+new Date()+'.json');
    fileStream.once('open', function(fd) {
      
      netSocketConnected(fileStream, llrpSocket, socket);

    });
*/
  
  // raw data listener
  var lineBuffer = '';
  var counter = 0;
  readerServerSocket.on('data', function(data) {
    //util.log('CHUNK:\n'+data);
    var lines = (''+data).split('\0'); // length at least 1
    var firstLines = _.initial(lines);
    var lastLine = _.last(lines);
    for (var i=0; i<firstLines.length; i++) {
      //util.log('array: '+firstLines[i]);
      var line = firstLines[i];
      if (i==0) {
        line = lineBuffer + line;
        counter++;
        lineBuffer = '';
      }
      line = (''+line).substring(1); // TODO: why is there a < character at the start of every line??
      //util.log('LINE '+counter +'('+ line.length+'):\n'+line);
      //for(var j=0; j<line.length; j++) {
      //  util.log('char '+j+':\''+line.charAt(j)+'\'');
      //}
      try {
        var readerEvent = JSON.parse(line);
        processReaderEvent(readerEvent);
      } catch (e) {
        console.error('JSON parse error in line:\n'+line, e); 
      }
    }
    lineBuffer += lastLine;
  //   util.log('DATA: ' + data);
  });
  
  /* readline can do the line splitting, but it is unclear how to do it without redirecting the stream to some output stream)
  var i = rl.createInterface(readerServerSocket, process.stdout);
  i.on('line', function (line) {
      //socket.write(line);
      util.log('Line: ' + line+'\n');
      
  });
  */
  readerServerSocket.on('close', function() {
    util.log('Connection closed');
  });
}

var tagState = {};


function processReaderEvent(readerEvent) {
  //util.log('emitting');
  //io.sockets.emit('llrp', readerEvent);
  //util.log(JSON.stringify(readerEvent));
  //if (fileStream) {
  //  fileStream.write(JSON.stringify(readerEvent)+'\n');
  //}
  if (!tagState[readerEvent.ePC]) {
    tagState[readerEvent.ePC] = [];
  }
  tagState[readerEvent.ePC][readerEvent.ant] = readerEvent.RSSI;
  //util.log(tagState);
}