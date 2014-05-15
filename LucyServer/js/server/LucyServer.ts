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
var lucyDataDirectoryPath = process.env['HOME'] + '/lucyData';
var saveDirectoryPath = lucyDataDirectoryPath + '/savedReaderEvents';

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
var outputFileStream : fs.WriteStream; // for saving reader events

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
    status: {isConnected: false, isSaving: false, webServerTime : null, readerServerTime : null},
    tagsData: []
  };
}

function initServer() {
  resetServerState();
  connectReaderServer();
  
  app = express();

  app.enable('trust proxy'); // Need this to get correct ip address when redirecting from lucy.oblomov.com

  app.use(express.compress());

  // serve 'client', 'shared', and 'node-modules' directories, but not 'server'
  app.use('/js/client', express.static(__dirname + '/../client'));
  app.use('/js/shared', express.static(__dirname + '/../shared'));
  app.use('/js/node_modules', express.static(__dirname + '/../node_modules'));
  app.use('/data', express.directory(lucyDataDirectoryPath));
  app.use('/data', express.static(lucyDataDirectoryPath));
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
    child_pr.exec( "/Users/martijn/git/Cercando/scripts/generateGitInfo.sh" // TODO: get rid of absolute path
                 , {cwd: '../..'}
                 , function(error, stdout, stderr) { 
                     res.setHeader('content-type', 'application/json');
                     res.send(stdout); 
                   } );
  });
  
  app.get('/query/tags', function(req, res) {  
    //util.log('Sending tag data to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    
    state.status.webServerTime = new Date().toString();
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
    disconnectReader();
    res.writeHead(204);
    res.end();
  });

  app.get('/query/reset', function(req, res) {  
    util.log('reset');
    resetServerState();
    res.writeHead(204);
    res.end();
  });

  app.get('/query/start-saving', function(req, res) {
    util.log('Start-saving request for filename ' + req.query.filename);
    
    var cont = { 
      success: function () {
        res.writeHead(204);
        res.end();
      },
      error: function(message : string) {
        res.send(403, { error: message });
      }
    };
    startSaving(decodeURI(req.query.filename), cont);
  });
  
  app.get('/query/stop-saving', function(req, res) {
    util.log('Stop-saving request');
    stopSaving();
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

function disconnectReader() {
  readerServerSocket.destroy(); // TODO: destroy is probably not the best way to close the socket (end doesn't work reliably though)
  readerServerSocket = null;
  state.status.isConnected = false;
}

function connectReaderServer() {
  if (readerServerSocket) {
    util.log('connectReaderServer: already connected');
    return;
  }
  
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
  readerServerSocket.on('close', function() {
    util.log('Connection closed');
    state.status.isConnected = false;
    if (readerServerSocket) 
      readerServerSocket.destroy(); // destoy socket if it wasn't already destroyed, just to make sure
    readerServerSocket = null;
    
    util.log('Connection to reader server lost, reconnecting..');
    setTimeout(function() { // automatically try to reconnect
      connectReaderServer();
    }, 1000);

  });

  tryToConnect(readerServerSocket);
}

function tryToConnect(readerServerSocket : net.Socket) {
  util.log('Trying to connect to reader server on '+readerServerHostName+':'+readerServerPortNr);
  readerServerSocket.connect(readerServerPortNr, readerServerHostName);
}

function readerServerConnected(readerServerSocket : net.Socket) {
  state.status.isConnected = true;
  util.log('Connected to reader server at: ' + readerServerHostName + ':' + readerServerPortNr);
  
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
      } catch (e) {
        console.error('JSON parse error in line:\n'+line, e); 
      }
      if (readerEvent)
        processReaderEvent(readerEvent);
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
}

function resetServerState() {
  state = initialServerState();
}

function startSaving(filePath : string, cont : {success : () => void; error : (message : string) => void}) {
  if (!isSafeFilePath(filePath))
    cont.error('Invalid file path: "'+filePath+'"\nMay only contain letters, digits, spaces, and these characters: \'(\' \')\' \'-\' \'_\'');
  else {
    var fullFilename = saveDirectoryPath + '/' + filePath+'.csv';
    outputFileStream = fs.createWriteStream(fullFilename);
    outputFileStream.on('error', function(err : Error) {
      util.log('Start-saving failed: ' + err.message);
      cont.error(err.message);
    });
    outputFileStream.once('open', function(fd :  number) {
      state.status.isSaving = true;
      // use the same csv format as the SessionOne app
      outputFileStream.write('EPC, Time, Date, Antenna, RSSI, Channel index, Memory bank, PC, CRC\n')
      util.log('Started saving events to "'+fullFilename+'"');
      cont.success();
    });
  }
}

function stopSaving() {
  outputFileStream.end()
  outputFileStream = null;
  state.status.isSaving = false;
}

var months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function processReaderEvent(readerEvent : ReaderEvent) {
  //util.log('Reader event');
  //util.log('emitting');
  //io.sockets.emit('llrp', readerEvent);
  //util.log(JSON.stringify(readerEvent));
  var readerTimestamp = new Date((new Date(readerEvent.firstSeen).getTime() + new Date(readerEvent.lastSeen).getTime())/2);

  if (outputFileStream) {
    var date = months[readerTimestamp.getMonth()]+'-'+readerTimestamp.getDate()+'-'+readerTimestamp.getFullYear();
    var time = readerTimestamp.getHours()+':'+util.padZero(2,readerTimestamp.getMinutes())+':'+
      util.padZero(2,readerTimestamp.getSeconds())+':'+util.padZero(4,readerTimestamp.getMilliseconds()*10);

    outputFileStream.write('\'0'+readerEvent.ePC+', '+time+', '+date+', '+readerEvent.ant+', '+readerEvent.RSSI+', , , , \n');
  }

  var tag = _.findWhere(state.tagsData, {epc: readerEvent.ePC});
  if (!tag) {
    var preferredColorObj = _.findWhere(allTagInfo, {epc: readerEvent.ePC});
    var color = preferredColorObj ? preferredColorObj.color : 'white';
    tag = { epc:readerEvent.ePC, color: color, rssis: [] }
    state.tagsData.push(tag);
  }
  
  // take the time in between firstSeen and lastSeen.
  state.status.readerServerTime = readerTimestamp.toString();
  
  //TODO Reader time is not in sync with server. For now, just use server time.
  var timestamp = new Date(); // use current time as timestamp.
  
  tag.rssis[readerEvent.ant-1] = filtered(readerEvent.ePC, readerEvent.ant, readerEvent.RSSI, timestamp, tag.rssis[readerEvent.ant-1]);
  trilateration.getRssiDistance(readerEvent.ePC, readerEvent.ant, readerEvent.RSSI);
  //util.log(tagsState);
}

function unfiltered(epc : string, antNr : number, rssi : number, timestamp : Date, previousRssi : Shared.RSSI) {
  return {value: rssi, timestamp: timestamp};
}

var RC = 1/2;

// epc : string, antNr : number just for logging
function filtered(epc : string, ant : number, rssi : number, timestamp : Date, previousRssi : Shared.RSSI) {
  var dT = (previousRssi ? timestamp.getTime() - previousRssi.timestamp.getTime() : 100)/1000;
  var previousRssiValue = previousRssi ? previousRssi.value : -30;
  
  var alpha = dT / (dT + RC);
  
  var newRssi = rssi * alpha + previousRssiValue * (1.0 - alpha);
  //util.log(epc+' '+ant);
  if (epc == '0000000000000000000000000370870' && ant == 3) {
    var dist3d = trilateration.getDistance3d(newRssi);
    var dist2d = trilateration.convert3dTo2d(dist3d);
    util.log(new Date().getSeconds()+' rssi: '+newRssi.toFixed(1) + ' dist3d: '+dist3d.toFixed(2)+' dist2d: '+dist2d.toFixed(2) +
             '   raw rssi: '+rssi);
  
  }

  //util.log(util.padZero(3,dT) + JSON.stringify(previousRssi) );
  //util.log(util.padZero(3,dT) + JSON.stringify(previousRssi.value) );
  return {ant : ant, value: newRssi, timestamp: timestamp};
}



// trilaterate all tags and age and distance for each rssi value
function trilaterateAllTags() {
  var now = new Date();
  _(state.tagsData).each((tag,i) => {
    _(tag.rssis).each((rssi,antNr) => {
      rssi.distance = trilateration.getRssiDistance(tag.epc, antNr, rssi.value);
      rssi.age = now.getTime() - rssi.timestamp.getTime(); 

      
      /*[{"ant":1,"value":-70.3080407663629,"timestamp":"2014-05-14T07:08:07.897Z","distance":4.465716581123385,"age":30}
  ,{"ant":2,"value":-57.150192202546535,"timestamp":"2014-05-14T07:08:07.796Z","distance":0.31433948708783727,"age":131}
  ,{"ant":3,"value":-57.150192202546535,"timestamp":"2014-05-14T07:07:14.045Z","distance":2.998144176986311,"age":53882}
  ,{"ant":4,"value":-61.35184579400259,"timestamp":"2014-05-14T07:08:07.858Z","distance":1.4579527081920527,"age":69}]
*/
/*
      // override for testing
      switch (antNr) {
        case 0:
          rssi.value = -71.150192202546535;
          rssi.distance =5.998144176986311;
          break;
        case 1:
          rssi.value = -61.35184579400259;
          rssi.distance = 1.4579527081920527;
          break;
        case 2:
          rssi.value = -70.3080407663629;
          rssi.distance = 4.465716581123385;
          break;
        case 3:
          rssi.value = -57.150192202546535;
          rssi.distance = 0.31433948708783727;
          break;
      }
      rssi.age = 10;
*/      
      return rssi.distance;
    });
    tag.coordinate = trilateration.trilaterateRssis(tag.epc, allAntennas, tag.rssis);
  });
}

// TODO: not used yet
var antennaTweaks = [1,0.97,1,0.97]; // poor man's calibration
function tweakAntenna(antennaNr : number, rssi : number) : number {
  return rssi * antennaTweaks[antennaNr-1];
}

// TODO: maybe store in config file
var allAntennas : Shared.Antenna[] =
   [{id:'r1-a1',name:'1', coord:{x:1.2,y:1.2}},{id:'r1-a2',name:'2', coord:{x:-1.2,y:1.2}},
    {id:'r1-a3',name:'3', coord:{x:-1.2,y:-1.2}},{id:'r1-a4',name:'4', coord:{x:1.2,y:-1.2}}];

var allTagInfo : Shared.TagInfo[] =
  [ {epc:'0000000000000000000000000370869', color:'green',     coord:{x:1.2-0*0.35, y:1.2-0*0.35}}
  , {epc:'0000000000000000000000000503968', color:'yellow',    coord:{x:1.2-1*0.35, y:1.2-1*0.35}}
  , {epc:'0000000000000000000000000370802', color:'black',     coord:{x:1.2-2*0.35-0.03, y:1.2-2*0.35}}
  , {epc:'0000000000000000000000000103921', color:'purple',    coord:{x:1.2-2*0.35+0.03, y:1.2-2*0.35}}
  , {epc:'0000000000000000000000000000795', color:'red',       coord:{x:1.2-3*0.35, y:1.2-3*0.35}}
  , {epc:'0000000000000000000000000370870', color:'orange',    coord:{x:1.2-4*0.35, y:1.2-4*0.35}}
  , {epc:'0000000000000000000000000370845', color:'white',     coord:{x:1.35, y:1.2-0.5-0*0.5}}
  , {epc:'0000000000000000000000000100842', color:'brown',     coord:{x:1.35, y:1.2-0.5-1*0.5}} 
  , {epc:'0000000000000000000000000503972', color:'gray',      coord:{x:1.35, y:1.2-0.5-2*0.5}}
  , {epc:'0000000000000000000000000023040', color:'lightblue', coord:null}
  , {epc:'0000000000000000000000000023140', color:'darkgray',  coord:null}
  ];


// Only allow letters, digits, and slashes
function isSafeFilePath(filePath : string) : boolean {
  return /^[a-zA-Z0-9" "\(\)\-\_]+$/.test(filePath);
}
