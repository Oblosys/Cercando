/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/express/express.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="./Trilateration.ts" />
/// <reference path="./Config.ts" />
/// <reference path="../shared/Shared.ts" />

var defaultServerPortNr = 8081; // port for the Simulator web server

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
import Config   = require('./Config');

var shared = <typeof Shared>require('../shared/Shared.js');

var app = express();

var state : Shared.ServerState
var allAntennaLayouts : Shared.AntennaLayout[];
var selectedAntennaLayout = 0;
var allAntennas : Shared.Antenna[];

var readerServerSocket : net.Socket;

var serverPortNr : number;


interface ReaderEvent {readerIp : string; ant : number; epc : string; rssi : number; firstSeen : string; lastSeen : string}

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
  setAntennaLayout(selectedAntennaLayout);
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
    
    res.send(JSON.stringify(allAntennaLayouts[selectedAntennaLayout].tagConfiguration));
  });


  app.get('/query/layout-info', function(req, res) {  
    util.log('Sending layout info to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    var layoutInfo : Shared.LayoutInfo =
      {selectedLayout: selectedAntennaLayout, names: _(allAntennaLayouts).pluck('name')}
    res.send(JSON.stringify(layoutInfo));
  });
    
  app.get('/query/select-layout/:nr', function(req, res) { // return AntennaInfo object for new selection  
    util.log('Selecting antenna layout '+req.params.nr+': '+allAntennaLayouts[req.params.nr].name +
             ',  sending antenna data to client. (' + new Date() + ')');
    setAntennaLayout(req.params.nr);
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify( getAntennaInfo(req.params.nr) ));
  });
  
  app.get('/query/connect', function(req, res) {  
    util.log('connect');
    res.writeHead(204);
    res.end();
  });

  app.get('/query/disconnect', function(req, res) {  
    util.log('disconnect');
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

function setAntennaLayout(nr : number) {
  selectedAntennaLayout = util.clip(0, allAntennaLayouts.length-1, nr);
  allAntennas = mkReaderAntennas(allAntennaLayouts[selectedAntennaLayout].readerAntennaSpecs);
}

function getAntennaInfo(nr : number) : Shared.AntennaInfo {
  var antennaLayout = allAntennaLayouts[nr];
  var info  = { name: antennaLayout.name, dimensions: antennaLayout.dimensions, scale: antennaLayout.scale
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

/// Simulator-specific code

function startReaderServer() {
}