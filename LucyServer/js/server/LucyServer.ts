/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/express/express.d.ts" />
/// <reference path="../typings/socket.io/socket.io.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />
/// <reference path="./Trilateration.ts" />

var defaultServerPortNr = 8080; // port for the Lucy web server

var remoteHostName = "lucy.oblomov.com";
var readerServerPortNr = 8193;

import http     = require("http");
import express  = require('express');
import net      = require('net');
import child_pr = require('child_process'); // for svn revision
import util     = require('oblo-util');
import fs       = require('fs');
import url      = require('url');
import Backbone = require('backbone');

import _        = require('underscore');
import path     = require('path');
//import rl       = require('readline');
import trilateration = require('./Trilateration');

var socketIO = require('socket.io');

var app : express.Express;
var readerServerSocket : net.Socket;

var readerServerHostName : string;
var serverPortNr : number

var state : Shared.ServerState


// usage: LucyServer [portNr] [remoteReader]
var portArg = parseInt(process.argv[2]);
serverPortNr = portArg || defaultServerPortNr;

if (process.argv[2] == 'remoteReader' || portArg && process.argv[3] == 'remoteReader') {
  // use remoteReader to connect to reader server on lucy.oblomov.com instead of localhost 
  readerServerHostName = remoteHostName;
} else {
  readerServerHostName = "localhost";
}
util.log('\n\n\nStarting web server on port ' + serverPortNr + ', using reader server on ' + readerServerHostName + '\n\n');

interface ReaderEvent {firstSeen : string; lastSeen : string; ePC : string; ant : number; RSSI : number}

// Duplicated, until we find an elegant way to share both types and code between client and server TypeScript
function initialServerState() : Shared.ServerState {
  return {
    visibleTags: [],
    status: {isConnected: false, isSaving: false},
    tagsData: []
  };
}

function initServer() {
  state = initialServerState();
  
  app = express();

  app.enable('trust proxy'); // Need this to get correct ip address when redirecting from lucy.oblomov.com

  app.use(express.compress());

  // serve 'client', 'shared', and 'node-modules' directories, but not 'server'
  app.use('/js/client', express.static(__dirname + '/../client'));
  app.use('/js/shared', express.static(__dirname + '/../shared'));
  app.use('/js/node_modules', express.static(__dirname + '/../node_modules'));
  app.use('/data', express.directory(process.env['HOME'] + '/lucyData'));
  app.use('/data', express.static(process.env['HOME'] + '/lucyData'));
  app.get('/', function(req, res) { res.redirect('/locator.html'); }); // redirect '/' to '/locator.html'
  app.use(express.static(__dirname + '/../../www')); //  serve 'www' directory as root directory

  //app.use(express.logger()); 
  app.use(function(req : express.Request, res : express.Response, next : Function) { // logger only seems to report in GMT, so we log by hand
    var now = new Date();
    util.log('\nRQ: ' + util.showDate(now) + ' ' + util.showTime(now) + ' (' + req.ip + ', "' + req.headers['user-agent'].slice(0,20) + '..") path:' + req.path);
    next();
  });

  app.use(express.bodyParser()); 

  app.get('/query/version', function(req, res) {  
    child_pr.exec( "/Users/martijn/git/Cercando/scripts/generateGitInfo.sh"
                 , {cwd: '../..'}
                 , function(error, stdout, stderr) { 
                     res.setHeader('content-type', 'application/json');
                     res.send(stdout); 
                   } );
  });
  
  app.get('/query/tags', function(req, res) {  
    //util.log('Sending tag data to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    
    trilaterateAllTags();
    
    res.send(JSON.stringify(state));
  });

  app.get('/query/connect', function(req, res) {  
    util.log('connect');
    connectReaderServer();
    res.writeHead(204);
    res.end();
  });

  app.get('/query/disconnect', function(req, res) {  
    util.log('disconnect');
    if (readerServerSocket) {
      readerServerSocket.write('\n');
    }
    res.writeHead(204);
    res.end();
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
server.listen(serverPortNr);

/* 
  io.sockets.on('connection', function (socket) {
  });
      //socket.on('my other event', function (data) {
    //  util.log(data);
    //});

 */


function connectReaderServer() {
  readerServerSocket = new net.Socket();

  readerServerSocket.on('error', function(err : any) { // TODO: not typed
    util.log('Connection to reader server failed (error code: ' + err.code + '), retrying..');
  });
  var connectInterval = 
    setInterval(function() {
      util.log('Trying to connect to reader server on '+readerServerHostName+':'+readerServerPortNr);
      readerServerSocket.connect(readerServerPortNr, readerServerHostName);
     
      readerServerSocket.on('connect', function() {
        util.log('Connected to reader server');
        clearInterval(connectInterval);
        readerServerConnected(readerServerSocket);
      });
      }, 2000); // TODO: interval can fire before connect failed, use timeout
}

function readerServerConnected(readerServerSocket : net.Socket) {
  util.log('Connected to reader server at: ' + readerServerHostName + ':' + readerServerPortNr);
/*
    var fileStream = fs.createWriteStream('calibratie/Output-'+new Date()+'.json');
    fileStream.once('open', function(fd) {
      
      netSocketConnected(fileStream, llrpSocket, socket);

    });
*/
  
  // raw data listener
  var lineBuffer = '';
  var counter = 0;
  readerServerSocket.on('data', function(data : string) {
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
        var readerEvent : ReaderEvent = JSON.parse(line);
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

function processReaderEvent(readerEvent : ReaderEvent) {
  //util.log('Reader event');
  //util.log('emitting');
  //io.sockets.emit('llrp', readerEvent);
  //util.log(JSON.stringify(readerEvent));
  //if (fileStream) {
  //  fileStream.write(JSON.stringify(readerEvent)+'\n');
  //}

  var tag = _.findWhere(state.tagsData, {epc: readerEvent.ePC});
  if (!tag) {
    var preferredColorObj = _.findWhere(preferredTagColors, {epc: readerEvent.ePC});
    var color = preferredColorObj ? preferredColorObj.color : 'white';
    state.tagsData.push({ epc:readerEvent.ePC, color: color, rssis: [] });
  }
  tag.rssis[readerEvent.ant-1] = readerEvent.RSSI;
  //util.log(tagsState);
}

function trilaterateAllTags() {
  _(state.tagsData).each((tag,i) => {
    var rssiDistances = _(tag.rssis).map((rssi) => {
      return trilateration.getRssiDistance(rssi);
    });
    tag.coordinate = trilateration.trilaterateDistances(antennaCoords, rssiDistances);
    tag.distances = rssiDistances;
  });
}


// TODO: share these with client and maybe store in config file
var antennaCoords = [{x:1.5,y:0},{x:0,y:1.5},{x:-1.5,y:0},{x:0,y:-1.5}] 

// TODO: not used yet
var antennaTweaks = [1,0.97,1,0.97]; // poor man's calibration
function tweakAntenna(antennaNr : number, rssi : number) : number {
  return rssi * antennaTweaks[antennaNr-1];
}


var preferredTagColors =
  [ {epc:'0000000000000000000000000100842', color:'red'} 
  , {epc:'0000000000000000000000000503968', color:'yellow'}
  , {epc:'0000000000000000000000000503968', color:'yellow'}
  , {epc:'0000000000000000000000000503972', color:'gray'}
  , {epc:'0000000000000000000000000370802', color:'black'}
  , {epc:'0000000000000000000000000370870', color:'orange'}
  , {epc:'0000000000000000000000000370869', color:'green'}
  , {epc:'0000000000000000000000000103921', color:'purple'}
  , {epc:'0000000000000000000000000000795', color:'brown'}
  , {epc:'0000000000000000000000000023040', color:'lightblue'}
  , {epc:'0000000000000000000000000023140', color:'darkgray'}
  , {epc:'0000000000000000000000000370845', color:'white'}
  ];
