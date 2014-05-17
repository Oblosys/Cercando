/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/express/express.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="./Trilateration.ts" />
/// <reference path="../shared/Shared.ts" />

var defaultServerPortNr = 8080; // port for the Lucy web server

var remoteHostName = "lucy.oblomov.com";
var readerServerPortNr = 8193;
var reconnectInterval = 2000; // time in ms to wait before trying to reconnect to the reader server
var useSmoother = true;
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
import trilateration = require('./Trilateration');

var shared = <typeof Shared>require('../shared/Shared.js');

var app = express();

var state : Shared.ServerState
var allAntennaLayouts : Shared.AntennaLayout[];
var selectedAntennaLayout = 0;
var allAntennas : Shared.Antenna[];
var allTagInfo : Shared.TagInfo[];

var readerServerSocket : net.Socket;
var outputFileStream : fs.WriteStream; // for saving reader events

var readerServerHostName : string;
var serverPortNr : number


interface ReaderEvent {readerIp : string; ant : number; epc : string; rssi : number; firstSeen : string; lastSeen : string}

var months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];


initServer();

function initServer() {
  // usage: LucyServer [portNr] [remoteReader]
  var portArg = parseInt(process.argv[2]);
  serverPortNr = portArg || defaultServerPortNr;
  
  if (process.argv[2] == 'remoteReader' || portArg && process.argv[3] == 'remoteReader') {
    // use remoteReader to connect to reader server on lucy.oblomov.com instead of localhost 
    readerServerHostName = remoteHostName;
  } else {
    readerServerHostName = "localhost";
  }
  util.log('\n\n\nStarting Lucy server on port ' + serverPortNr + ', using reader server on ' + readerServerHostName + '\n\n');
  
  resetServerState();
  connectReaderServer();
  initExpress();
  var server = app.listen(serverPortNr, () => { util.log('Web server listening to port ' + serverPortNr);});
}

function resetServerState() {
  state = shared.initialServerState();
  allAntennaLayouts = getAllAntennaLayouts();
  setAntennaLayout(selectedAntennaLayout);
  allTagInfo = getAllTagInfo();
}

function initExpress() {
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

  app.get('/query/layout-names', function(req, res) {  
    util.log('Sending layout names to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify( _(allAntennaLayouts).pluck('name')) );
  });
  
  app.get('/query/select-layout/:nr', function(req, res) {  
    util.log('Selecting antenna layout '+req.params.nr+': '+allAntennaLayouts[req.params.nr].name +
             ',  sending antenna data to client. (' + new Date() + ')');
    setAntennaLayout(req.params.nr);
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

function setAntennaLayout(nr : number) {
  selectedAntennaLayout = nr;
  allAntennas = mkReaderAntennas(allAntennaLayouts[selectedAntennaLayout].readerAntennaSpecs);
}

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
    if (readerServerSocket) 
      readerServerSocket.destroy();
  });
  readerServerSocket.on('close', function() {
    util.log('Connection closed');
    destroySocketAndRetryConnection();
  });

  util.log('Trying to connect to reader server on '+readerServerHostName+':'+readerServerPortNr);
  readerServerSocket.connect(readerServerPortNr, readerServerHostName);
}

function destroySocketAndRetryConnection() {
  state.status.isConnected = false;
  if (readerServerSocket) 
    readerServerSocket.destroy(); // destroy socket if it wasn't already destroyed, just to make sure
  readerServerSocket = null;
  
  util.log('Connection to reader server lost, reconnecting..');
  setTimeout(function() { // automatically try to reconnect
    connectReaderServer();
  }, reconnectInterval);
}

function readerServerConnected(readerServerSocket : net.Socket) {
  state.status.isConnected = true;
  util.log('Connected to reader server at: ' + readerServerHostName + ':' + readerServerPortNr);
  
  // raw data listener
  var lineBuffer = '';
  readerServerSocket.on('data', function(buffer : NodeBuffer) {
    var chunk : string = buffer.toString('utf8');
    //util.log('CHUNK:\n'+data);
    var lines = chunk.split('\0\ufffd'); // \0\fffd precedes every string received from the socket 
    
    // util.log('LINES:'+lines);
    var firstLines = _.initial(lines); // lines.length will be at least 1
    var lastLine = _.last(lines);
    for (var i=0; i<firstLines.length; i++) {
      var line = firstLines[i];
      if (i==0) {
        line = lineBuffer + line;
        lineBuffer = '';
      }
      if (line != '') { // first line of strean will always be ''
        try {
          var readerEvent : ReaderEvent = JSON.parse(line);
        } catch (e) {
          console.error('JSON parse error in line:\n"'+line+'"', e); 
        }
        if (readerEvent)
          processReaderEvent(readerEvent);
      }
    }
    lineBuffer += lastLine;
  });
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

function processReaderEvent(readerEvent : ReaderEvent) {
  var readerTimestamp = new Date((new Date(readerEvent.firstSeen).getTime() + new Date(readerEvent.lastSeen).getTime())/2);
  // take the time in between firstSeen and lastSeen.

  if (outputFileStream) {
    var date = months[readerTimestamp.getMonth()]+'-'+readerTimestamp.getDate()+'-'+readerTimestamp.getFullYear();
    var time = readerTimestamp.getHours()+':'+util.padZero(2,readerTimestamp.getMinutes())+':'+
      util.padZero(2,readerTimestamp.getSeconds())+':'+util.padZero(4,readerTimestamp.getMilliseconds()*10);

    // Mimic the save format created by Motorola SessionOne app
    outputFileStream.write('\'0'+readerEvent.epc+', '+time+', '+date+', '+readerEvent.ant+', '+readerEvent.rssi+', , , , \n');
  }

  var tag = _.findWhere(state.tagsData, {epc: readerEvent.epc});
  if (!tag) {
    var preferredColorObj = _.findWhere(allTagInfo, {epc: readerEvent.epc});
    var color = preferredColorObj ? preferredColorObj.color : 'white';
    tag = { epc:readerEvent.epc, color: color, antennaRssis: [] }
    state.tagsData.push(tag);
  }
  
  state.status.readerServerTime = readerTimestamp.toString();
  
  //TODO Reader time is not in sync with server. For now, just use server time.
  var timestamp = new Date(); // use current time as timestamp.
  
  var antId = mkAntennaId(readerEvent.readerIp, readerEvent.ant);
  var antNr = getAntennaNr(antId);
  var oldAntennaRssi = getAntennaRssiForAntNr(antNr, tag.antennaRssis);
  
  var newRssi = !useSmoother ? readerEvent.rssi 
                             : filtered(readerEvent.epc, readerEvent.ant, readerEvent.rssi, timestamp, oldAntennaRssi);
  var newAntennaRssi = {antNr: antNr, value: newRssi, timestamp: timestamp};
  //if (readerEvent.epc == '0000000000000000000000000503968' && readerEvent.ant == 1) {
  //  util.log(new Date().getSeconds() + ' ' + readerEvent.epc + ' ant '+readerEvent.ant + ' rawRssi: '+readerEvent.rssi.toFixed(1) + ' dist: '+
  //          trilateration.getRssiDistance(readerEvent.epc, ''+readerEvent.ant, readerEvent.rssi));
  //}
  
  updateAntennaRssi(newAntennaRssi, tag.antennaRssis);
  //trilateration.getRssiDistance(readerEvent.ePC, readerEvent.ant, readerEvent.RSSI);
  //util.log(tagsState);
}

function getAntennaRssiForAntNr(antNr : number, antennaRssis : Shared.AntennaRSSI[]) {
  var ix = _(antennaRssis).pluck('antNr').indexOf(antNr);
  return ix == -1 ? null : antennaRssis[ix];
}

function updateAntennaRssi(newAntennaRssi : Shared.AntennaRSSI, antennaRssis : Shared.AntennaRSSI[]) {
  var ix = _(antennaRssis).pluck('antNr').indexOf(newAntennaRssi.antNr);
  if (ix >= 0)
    antennaRssis[ix] = newAntennaRssi; // update
  else
    antennaRssis.push(newAntennaRssi); // or add
}

// epc : string, antNr : number just for logging
function filtered(epc : string, ant : number, rssi : number, timestamp : Date, previousAntennaRssi : Shared.AntennaRSSI) {
  var RC = 1/2;

  var dT = (previousAntennaRssi ? timestamp.getTime() - previousAntennaRssi.timestamp.getTime() : 100)/1000;
  var previousRssi = previousAntennaRssi ? previousAntennaRssi.value : rssi;
  
  var alpha = dT / (dT + RC);
  
  var newRssi = rssi * alpha + previousRssi * (1.0 - alpha);
  //if (epc == '0000000000000000000000000503968' && ant == 1) {
  //  util.log(new Date().getSeconds() + ' ' + epc + ' ant '+ant + ' prevRssi: '+previousRssi.toFixed(1) + ' rawRssi: '+rssi.toFixed(1) + ' newDist: '+
  //           trilateration.getRssiDistance(epc, ''+ant, newRssi).toFixed(1) + ' newRssi: '+newRssi.toFixed(1));
  //}
  
  //util.log(util.padZero(3,dT) + JSON.stringify(previousRssi) );
  //util.log(util.padZero(3,dT) + JSON.stringify(previousRssi.value) );
  return newRssi;
}



// trilaterate all tags and age and distance for each rssi value
function trilaterateAllTags() {
  var now = new Date();
  _(state.tagsData).each((tag) => {
    _(tag.antennaRssis).each((antennaRssi) => {
      antennaRssi.distance = trilateration.getRssiDistance(tag.epc, allAntennas[antennaRssi.antNr].name, antennaRssi.value);
      antennaRssi.age = now.getTime() - antennaRssi.timestamp.getTime(); 

      
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
      return antennaRssi.distance;
    });
    tag.coordinate = trilateration.trilaterateRssis(tag.epc, allAntennas, tag.antennaRssis);
  });
}

function mkAntennaId(readerIp : string, antennaPort : number){ // antennaPort starts at 1
  return 'r'+readerIp+'-a'+antennaPort;
}

function mkReaderAntennas(readerAntennaSpecs : Shared.ReaderAntennaSpec[]) : Shared.Antenna[] {
  var antenass = _.map(readerAntennaSpecs, (readerAntennaSpec) => {return mkAntennas(readerAntennaSpec.readerIp, readerAntennaSpec.antennaSpecs);});
  return _.flatten(antenass);
}

function mkAntennas(readerIp : string, antennaLocations : Shared.AntennaSpec[] ) : Shared.Antenna[] {
  return antennaLocations.map((antLoc, ix) => {return {antId: mkAntennaId(readerIp, ix+1), name: antLoc.name, coord: antLoc.coord}});
}


// return the index in allAntennas for the antenna with id ant 
function getAntennaNr(antid : string) {
  var ix = _(allAntennas).pluck('antId').indexOf(antid);
  if (ix == -1) 
    console.error('Antenna with id %s not found in allAntennas', antid)
  return ix;
}

// Only allow letters, digits, and slashes
function isSafeFilePath(filePath : string) : boolean {
  return /^[a-zA-Z0-9" "\(\)\-\_]+$/.test(filePath);
}



// TODO: store in config file
function getAllAntennaLayouts() : Shared.AntennaLayout[] {
  var groningenHorizontaal =
    { name: 'Groningen (horizontaal)'
    , readerAntennaSpecs:
        [ { readerIp: '10.0.0.30' 
          , antennaSpecs: [ {name:'1', coord:{x:1.2,  y:1.2}}
                          , {name:'2', coord:{x:-1.2, y:1.2}}
                          , {name:'3', coord:{x:-1.2, y:-1.2}}
                          , {name:'4', coord:{x:1.2,  y:-1.2}}
                          ]
          }
        ]
    };

  var groningenSchuin =
    { name: 'Groningen (schuin)'
    , readerAntennaSpecs:
        [ { readerIp: '10.0.0.30' 
          , antennaSpecs: [ {name:'1', coord:{x:1.5,  y:0}}
                          , {name:'2', coord:{x:0,    y:1.5}}
                          , {name:'3', coord:{x:-1.5, y:0}}
                          , {name:'4', coord:{x:0,    y:-1.5}}
                          ]
          }
        ]
    };
  
  return [groningenHorizontaal, groningenSchuin];
}

function getAllTagInfo() : Shared.TagInfo[] {
  return [ {epc:'0000000000000000000000000370869', color:'green',     coord:{x:1.2-0*0.35, y:1.2-0*0.35}}
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
}

