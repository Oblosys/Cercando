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
  resetServerState();
  
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

  app.get('/query/tag-info', function(req, res) {  
    util.log('Sending tag info to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    
    res.send(JSON.stringify(allTagInfo));
  });

  app.get('/query/antennas', function(req, res) {  
    util.log('Sending antenna data to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify(allAntennas));
  });
  
  app.get('/query/connect', function(req, res) {  
    util.log('connect');
    connectReaderServer();
    res.writeHead(204);
    res.end();
  });

  app.get('/query/disconnect', function(req, res) {  
    util.log('disconnect');
    readerServerSocket.destroy(); // TODO: destroy is probably not the best way to close the socket (end doesn't work reliably though)
    res.writeHead(204);
    res.end();
  });

  app.get('/query/reset', function(req, res) {  
    util.log('reset');
    resetServerState();
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

function resetServerState() {
  state = initialServerState();
}

function connectReaderServer() {
  if (readerServerSocket)
    readerServerSocket.destroy(); // TODO: destroy is probably not the best way to close the socket (end doesn't work reliably though)

  readerServerSocket = new net.Socket();
  
  readerServerSocket.on('connect', function() {
    readerServerConnected(readerServerSocket);
  });
  readerServerSocket.on('error', function(err : any) { // TODO: not typed
    util.log('Connection to reader server failed (error code: ' + err.code + '), retrying..');
    setTimeout(function() {
      tryToConnect(readerServerSocket);
    }, 1000);
  });
  
  tryToConnect(readerServerSocket);
}

function tryToConnect(readerServerSocket : net.Socket) {
  util.log('Trying to connect to reader server on '+readerServerHostName+':'+readerServerPortNr);
  readerServerSocket.connect(readerServerPortNr, readerServerHostName);
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
    var preferredColorObj = _.findWhere(allTagInfo, {epc: readerEvent.ePC});
    var color = preferredColorObj ? preferredColorObj.color : 'white';
    state.tagsData.push({ epc:readerEvent.ePC, color: color, rssis: [] });
  }
  
  // take the time in between firstSeen and lastSeen. TODO Reader time is not in sync with server. For now, just use server time.
  //var timestamp = new Date((new Date(readerEvent.firstSeen).getTime() + new Date(readerEvent.lastSeen).getTime())/2);
  var timestamp = new Date(); // use current time as timestamp.
  tag.rssis[readerEvent.ant-1] = {value: readerEvent.RSSI, timestamp: timestamp};
  //util.log(tagsState);
}

// trilaterate all tags and age and distance for each rssi value
function trilaterateAllTags() {
  var now = new Date();
  _(state.tagsData).each((tag,i) => {
    var rssiDistances = _(tag.rssis).map((rssi) => {
      rssi.distance = trilateration.getRssiDistance(rssi.value);
      rssi.age = now.getTime() - rssi.timestamp.getTime(); 
      return rssi.distance;
    });
    tag.coordinate = trilateration.trilaterateDistances(allAntennas, rssiDistances);
  });
}

// TODO: not used yet
var antennaTweaks = [1,0.97,1,0.97]; // poor man's calibration
function tweakAntenna(antennaNr : number, rssi : number) : number {
  return rssi * antennaTweaks[antennaNr-1];
}

// TODO: maybe store in config file
var allAntennas : Shared.Antenna[] =
   [{id:'r1-a1',name:'1', coord:{x:1.5,y:0}},{id:'r1-a2',name:'2', coord:{x:0,y:1.5}},
    {id:'r1-a3',name:'3', coord:{x:-1.5,y:0}},{id:'r1-a4',name:'4', coord:{x:0,y:-1.5}}];

var allTagInfo : Shared.TagInfo[] =
  [ {epc:'0000000000000000000000000100842', color:'red',       coord:{x:0,y:0}} 
  , {epc:'0000000000000000000000000503968', color:'yellow',    coord:{x:0.53,y:-0.53}}
  , {epc:'0000000000000000000000000503972', color:'gray',      coord:{x:0.53,y:0.53}}
  , {epc:'0000000000000000000000000370802', color:'black',     coord:{x:-0.53,y:0.53}}
  , {epc:'0000000000000000000000000370870', color:'orange',    coord:{x:-0.53,y:-0.53}}
  , {epc:'0000000000000000000000000370869', color:'green',     coord:{x:1.06,y:-1.06}}
  , {epc:'0000000000000000000000000103921', color:'purple',    coord:{x:1.06,y:1.06}}
  , {epc:'0000000000000000000000000000795', color:'brown',     coord:{x:-1.06,y:1.06}}
  , {epc:'0000000000000000000000000023040', color:'lightblue', coord:{x:-1.06,y:-1.06}}
  , {epc:'0000000000000000000000000023140', color:'darkgray',  coord:{x:1.42,y:0}}
  , {epc:'0000000000000000000000000370845', color:'white',     coord:{x:1.42,y:-0.5}}
  ];
