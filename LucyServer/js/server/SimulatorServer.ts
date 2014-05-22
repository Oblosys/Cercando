/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/express/express.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="./Trilateration.ts" />
/// <reference path="./Config.ts" />
/// <reference path="../shared/Shared.ts" />
/// <reference path="./ServerCommon.ts" />

var defaultServerPortNr = 8081; // port for the Simulator web server

var readerServerPortNr = 8193;
var reconnectInterval = 2000; // time in ms to wait before trying to reconnect to the reader server
var useSmoother = true;
var lucyDataDirectoryPath = process.env['HOME'] + '/lucyData';
var saveDirectoryPath = lucyDataDirectoryPath + '/savedReaderEvents';

import http     = require('http');
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
import Config   = require('./Config');
import ServerCommon   = require('./ServerCommon');

var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails

var app = express();

// Simulator-specific state
var tagCoord : Shared.Coord = {x:0, y:0};
var readerServerSocket : net.Socket;


var state : Shared.ServerState
var allAntennaLayouts : Shared.AntennaLayout[];
var allAntennas : Shared.Antenna[];


var serverPortNr : number;

var months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];


initServer();

function initServer() {
  // usage: LucyServer [portNr] [remoteReader]
  var portArg = parseInt(process.argv[2]);
  serverPortNr = portArg || defaultServerPortNr;
  
  util.log('\n\n\nStarting Simulator server on port ' + serverPortNr);
  
  resetServerState();
  startReaderServer();
  initExpress();
  var server = app.listen(serverPortNr, () => { util.log('Web server listening to port ' + serverPortNr);});
}

function resetServerState() {
  state = shared.initialServerState();
  allAntennaLayouts = Config.getAllAntennaLayouts();
  setAntennaLayout(state.selectedAntennaLayout);
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
  app.get('/', function(req, res) { res.redirect('/simulator.html'); }); // redirect '/' to '/locator.html'
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
  
  app.get('/query/tag-info', function(req, res) {  
    util.log('Sending tag info to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    
    res.send(JSON.stringify(allAntennaLayouts[state.selectedAntennaLayout].tagConfiguration));
  });

  app.get('/query/layout-info', function(req, res) {  
    util.log('Sending layout info to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    var layoutInfo : Shared.LayoutInfo =
      {selectedLayout: state.selectedAntennaLayout, names: _(allAntennaLayouts).pluck('name')}
    res.send(JSON.stringify(layoutInfo));
  });
    
  app.get('/query/select-layout/:nr', function(req, res) { // return AntennaInfo object for new selection  
    util.log('Selecting antenna layout '+req.params.nr+': '+allAntennaLayouts[req.params.nr].name +
             ',  sending antenna data to client. (' + new Date() + ')');
    setAntennaLayout(req.params.nr);
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify( getAntennaInfo(req.params.nr) ));
  });
  
  app.get('/query/reset', function(req, res) {  
    util.log('reset');
    resetServerState();
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });

  app.get('/query/test', function(req, res) {  
    util.log('test');
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });

  app.get('/query/move-tag/:x/:y', function(req, res) {  
    var newCoord : Shared.Coord = {x: parseFloat(req.params.x), y: parseFloat(req.params.y)};
    tagCoord = newCoord;
    util.log('Moving tag to ' + JSON.stringify(newCoord) );
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });

  app.get('/query/move-antenna/:nr/:x/:y', function(req, res) {  
    var antennaNr = parseInt(req.params.nr);
    var readerIp = allAntennas[antennaNr].antennaId.readerIp;
    var readerAntennaNr = allAntennas[antennaNr].antennaId.antennaNr; // 1-based
    var newCoord : Shared.Coord = {x: parseFloat(req.params.x), y: parseFloat(req.params.y)};
    util.log('Moving antenna '+allAntennas[antennaNr].antennaId+' to ' + JSON.stringify(newCoord) );
    allAntennas[antennaNr].coord = newCoord;
    var readerAntennaSpec = _(allAntennaLayouts[state.selectedAntennaLayout].readerAntennaSpecs).findWhere({readerIp: readerIp});
    
    if (readerAntennaSpec)
      readerAntennaSpec.antennaSpecs[ readerAntennaNr - 1 ].coord = newCoord;
    else
      console.error('Move: no readerAntennaSpec found for reader ' + readerIp);
    
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });
  
  app.get('/query/reader-antenna-spec', function(req, res) {  
    util.log('Sending current reader antenna spec to client. (' + new Date() + ')');
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    
    var indent = '        ';
    var spec = '    , readerAntennaSpecs:\n' +
               indent + util.showJSON(allAntennaLayouts[state.selectedAntennaLayout].readerAntennaSpecs, 20, indent) + '\n';
    
    res.send(spec);
  });
}

function setAntennaLayout(nr : number) {
  state.selectedAntennaLayout = util.clip(0, allAntennaLayouts.length-1, nr);
  allAntennas = ServerCommon.mkReaderAntennas(allAntennaLayouts[state.selectedAntennaLayout].readerAntennaSpecs);
  state.tagsData = [];
  state.unknownAntennaIds = [];
}

function getAntennaInfo(nr : number) : Shared.AntennaInfo {
  var antennaLayout = allAntennaLayouts[nr];
  var info  = { name: antennaLayout.name, dimensions: antennaLayout.dimensions, scale: antennaLayout.scale
              , backgroundImage: antennaLayout.backgroundImage
              , antennaSpecs: allAntennas }; // todo: global allAntennas ref is not elegant
  return info;
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

function mkAntennaId(readerIp : string, antennaPort : number){ // antennaPort starts at 1
  return 'r'+readerIp+'-a'+antennaPort;
}

// return the index in allAntennas for the antenna with id ant 
function getAntennaNr(antennaId : Shared.AntennaId) {
  for (var i = 0; i < allAntennas.length; i++) {
    if (allAntennas[i].antennaId.readerIp == antennaId.readerIp && allAntennas[i].antennaId.antennaNr == antennaId.antennaNr)
      return i;
  }
  return -1;
}


/// Simulator-specific code

var clientSocket : net.Socket;
var eventInterval : NodeTimer;
var eventEmissionDelay = 200; // 

function startReaderServer() {
  var server = net.createServer(function(c) { //'connection' listener
    clientSocket = c;
    util.log('server connected');
    c.on('end', function() {
      console.log('Client disconnected');
      clientSocket = null;
    });
    
    //c.pipe(c);
  });
  server.listen(readerServerPortNr, function() {
    console.log('Simulated reader server listening to '+readerServerPortNr);
    startEmittingEvents();
  });
}

function startEmittingEvents() {
    eventInterval = setInterval(emitEvents, eventEmissionDelay); 
}
  
function stopRefreshInterval() {
  clearInterval(eventInterval);
}

function emitEvents() {
  if (clientSocket) {
    //util.log('Client is connected, emitting event');
    var readerEvents : ServerCommon.ReaderEvent[] = [];
    for (var i=0; i<allAntennas.length; i++) {
      var rssi = pointToRssi(i, tagCoord);
      var readerEvent = createReaderEvent(allAntennas[i].antennaId.readerIp, '0000000000000000000000000503966', allAntennas[i].antennaId.antennaNr, rssi);
      
      if (rssi) {
        //util.log(readerEvent);        
        readerEvents.push(readerEvent);
      }
    }
    sendReaderEvents(readerEvents);
  }
}

function sendReaderEvents(readerEvents : ServerCommon.ReaderEvent[]) {
  if (clientSocket)
    _(readerEvents).forEach((e) => {clientSocket.write('\0\ufffd'+JSON.stringify(e));});
}

function createReaderEvent(readerIp : string, epc : string, ant : number, rssi : number)  : ServerCommon.ReaderEvent {
  var timestamp = new Date().toString();
  return { readerIp : readerIp, ant: ant, epc: epc, rssi : rssi
         , firstSeen: timestamp, lastSeen : timestamp };
}

// antennaIx is index in allAntennas, not the antenna number
function pointToRssi(antennaIx : number, p : Shared.Coord) : number {
  var antennaCoord = allAntennas[antennaIx].coord;
  var dist = trilateration.distance(antennaCoord.x, antennaCoord.y, p.x, p.y);
  //util.log('ant '+JSON.stringify(antennaCoord)+' :'+dist.toFixed(2)+ ' '+p.x.toFixed(1)+' '+p.y.toFixed(1));
  
  if (dist > shared.maxAntennaRange)
    return null;
  else
    return trilateration.getRssiForDistance3d(dist);
}
