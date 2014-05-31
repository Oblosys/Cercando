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

// configuration constants

var defaultServerPortNr = 8080; // port for the Lucy web server
var remoteHostName = "lucy.oblomov.com";
var readerServerPortNr       = 8193;
var presentationServerPortNr = 8199;
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

// global state variables

var state : Shared.ServerState
var previousPositioningTimestamp : number; // timestamp in milleseconds for the last time all tag positions were computed
var allAntennaLayouts : Shared.AntennaLayout[];
var allAntennas : Shared.Antenna[];

var readerServerSocket : net.Socket;
var outputFileStream : fs.WriteStream; // for saving reader events

var readerServerHostName : string;
var serverPortNr : number;



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
  initExpress();
  var server = app.listen(serverPortNr, () => { util.log('Web server listening to port ' + serverPortNr);});
}

function resetServerState() {
  state = shared.initialServerState();
  disconnectReader();
  connectReaderServer();
  allAntennaLayouts = Config.getAllAntennaLayouts();
  setAntennaLayout(state.selectedAntennaLayoutNr);
  util.log('Resetting server state');
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
    positionAllTags();
    
    res.send(JSON.stringify(state));
  });

  app.get('/query/layout-info', function(req, res) {  
    util.log('Sending layout info to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    var layoutInfo : Shared.LayoutInfo =
      {selectedLayoutNr: state.selectedAntennaLayoutNr, names: _(allAntennaLayouts).pluck('name')}
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
    connectReaderServer();
    res.setHeader('content-type', 'text/plain'); 
    // set content-type, otherwise jQuery infers JSON, and produces an error that is sometimes incorrectly located in other libraries
    res.writeHead(204);
    res.end();
  });

  app.get('/query/disconnect', function(req, res) {  
    util.log('disconnect');
    disconnectReader();
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });

  app.get('/query/reset', function(req, res) {  
    util.log('reset');
    resetServerState();
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });

  app.get('/query/start-saving', function(req, res) {
    util.log('Start-saving request for filename ' + req.query.filename);
    
    var cont = { 
      success: function () {
        res.setHeader('content-type', 'text/plain');
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
}

function setAntennaLayout(nr : number) {
  state.selectedAntennaLayoutNr = util.clip(0, allAntennaLayouts.length-1, nr);
  allAntennas = ServerCommon.mkReaderAntennas(allAntennaLayouts[state.selectedAntennaLayoutNr].readerAntennaSpecs);
  state.tagsData = [];
  state.unknownAntennaIds = [];
}

function getAntennaInfo(nr : number) : Shared.AntennaInfo {
  var antennaLayout = allAntennaLayouts[nr];
  var info  = { name: antennaLayout.name, dimensions: antennaLayout.dimensions, scale: antennaLayout.scale
              , backgroundImage: antennaLayout.backgroundImage
              , antennaSpecs: allAntennas  // todo: global allAntennas ref is not elegant
              , tagConfiguration : allAntennaLayouts[state.selectedAntennaLayoutNr].tagConfiguration 
              };
  return info;
}
    

function disconnectReader() {
  if (readerServerSocket) {
    readerServerSocket.destroy(); // TODO: destroy is probably not the best way to close the socket (end doesn't work reliably though)
    readerServerSocket = null;
  }
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

// Helper function to show \0 and \ufffd characters.
function showInvisibles(str : string) {
  return str.replace('\0','\\0').replace('\ufffd','\\ufffd');
}

function readerServerConnected(readerServerSocket : net.Socket) {
  state.status.isConnected = true;
  util.log('Connected to reader server at: ' + readerServerHostName + ':' + readerServerPortNr);
  
  // raw data listener
  var lineBuffer = '';
  readerServerSocket.on('data', function(buffer : NodeBuffer) {
    var chunk : string = buffer.toString('utf8');
    //util.log('CHUNK:\n'+showInvisibles(chunk));
  
    // Lines from the socket are separated by '\0\ufffd'. Because sometimes the chuncks are split in the middle of \0\ufffd:
    // e.g.: Chunk i : '.....\0', Chunk i+1 : '\ufffd.......', we remove a possible trailing '\0' and replace a possible initial
    // '\ufffd' with '\0\ufffd'.
    chunk = chunk.replace(/\0$/,'').replace(/^\ufffd/, '\0\ufffd');    
  
    // After this, we can split on '\0\ufffd'
    var lines = chunk.split('\0\ufffd'); 
    // lines.length will be at least 1
    
    var lastLine = _.last(lines);
    //util.log('Line buffer '+showInvisibles(lineBuffer)) 
    //_(lines).each((l,i)=>{util.log('Line '+i+':'+showInvisibles(l))});
    var firstLines = _.initial(lines);
    
    for (var i=0; i<firstLines.length; i++) {
      var line = firstLines[i];
      if (i==0) {
        line = lineBuffer + line;
        lineBuffer = '';
      }
      if (line != '') { // first line of stream will always be ''
        try {
          var readerEvent : ServerCommon.ReaderEvent = JSON.parse(line);
        } catch (e) {
          util.error('JSON parse error in line:\n"'+showInvisibles(line)+'"', e);
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
    mkUniqueFilePath(fullFilename, (uniqueFilePath) => {
      outputFileStream = fs.createWriteStream(uniqueFilePath);
      outputFileStream.on('error', function(err : Error) {
        util.log('Start-saving failed: ' + err.message);
        cont.error(err.message);
      });
      outputFileStream.once('open', function(fd :  number) {
        state.status.isSaving = true;
        // Mimic the save format created by Motorola SessionOne app, but add the reader ip in an extra column (ip is not saved by SessionOne) 
        outputFileStream.write('EPC, Time, Date, Antenna, RSSI, Channel index, Memory bank, PC, CRC, ReaderIp\n')
        util.log('Started saving events to "'+fullFilename+'"');
        cont.success();
      });
    });
  }
}

function stopSaving() {
  outputFileStream.end()
  outputFileStream = null;
  state.status.isSaving = false;
}

function processReaderEvent(readerEvent : ServerCommon.ReaderEvent) {
  var months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  var readerTimestamp = new Date((new Date(readerEvent.firstSeen).getTime() + new Date(readerEvent.lastSeen).getTime())/2);
  // take the time in between firstSeen and lastSeen.
  //util.log('Reader event: ' + JSON.stringify(readerEvent));
  if (outputFileStream) {
    var date = months[readerTimestamp.getMonth()]+'-'+readerTimestamp.getDate()+'-'+readerTimestamp.getFullYear();
    var time = readerTimestamp.getHours()+':'+util.padZero(2,readerTimestamp.getMinutes())+':'+
      util.padZero(2,readerTimestamp.getSeconds())+':'+util.padZero(4,readerTimestamp.getMilliseconds()*10);

    // Mimic the save format created by Motorola SessionOne app, but add the reader ip in an extra column (ip is not saved by SessionOne) 
    outputFileStream.write('\'0'+readerEvent.epc+', '+time+', '+date+', '+readerEvent.ant+', '+readerEvent.rssi+', , , , , '+readerEvent.readerIp+'\n');
  }

  var tag = _.findWhere(state.tagsData, {epc: readerEvent.epc});
  if (!tag) {
    tag = { epc:readerEvent.epc, antennaRssis: [], metaData: {name: ''} }
    util.log('Encountered new tag '+tag.epc);
    state.tagsData.push(tag);
  }
  
  state.status.readerServerTime = readerTimestamp.toString();
  
  //TODO Reader time is not in sync with server. For now, just use server time.
  var timestamp = new Date(); // use current time as timestamp.
  
  var antennaId : Shared.AntennaId = {readerIp: readerEvent.readerIp, antennaNr: readerEvent.ant };
  var antNr = getAntennaNr(antennaId);
  if (antNr == -1) { // The antenna is not part of the current antenna configuration.
    if (!_(state.unknownAntennaIds).find((unknownId) => { 
        return _.isEqual(unknownId, antennaId);})) {
      state.unknownAntennaIds.push(antennaId);
    }
  } else {
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
    if (allAntennas[antNr].shortMidRangeTarget) {
      var shortMidRangeTarget = allAntennas[antNr].shortMidRangeTarget;
      //signalPresentationServer(shortMidRangeTarget.serverIp, shortMidRangeTarget.antennaIndex, readerEvent.epc);
    }
  }
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
function positionAllTags() {
  var nowTimestamp = new Date().getTime();
  var dt = previousPositioningTimestamp ? (nowTimestamp - previousPositioningTimestamp) / 1000 :  0
  previousPositioningTimestamp = nowTimestamp; 

  util.log(state.tagsData.length + ' tags')
  // compute distance and age for each antennaRssi for each tag
  _(state.tagsData).each((tag) => {
    util.log(tag.epc + ':' + tag.antennaRssis.length + ' signals');
    _(tag.antennaRssis).each((antennaRssi) => {
      antennaRssi.distance = trilateration.getRssiDistance(tag.epc, allAntennas[antennaRssi.antNr].name, antennaRssi.value);
      antennaRssi.age = nowTimestamp - antennaRssi.timestamp.getTime(); 
      return antennaRssi.distance;
    });
  });
  
  purgeOldTags();  
  
  // compute coordinate for each tag
  _(state.tagsData).each((tag) => {
    var shortMidRangeRssi = _(tag.antennaRssis).find((antennaRssi) => {
      var shortMidRangeTarget = allAntennas[antennaRssi.antNr].shortMidRangeTarget;
      return shortMidRangeTarget != null && shared.isRecentAntennaRSSI(antennaRssi);
    });
    if (shortMidRangeRssi) {
      util.log('short mid for tag '+tag.epc);
      tag.coordinate = {coord: allAntennas[shortMidRangeRssi.antNr].coord, isRecent:true};
    } else {
      var oldCoord = tag.coordinate ? tag.coordinate.coord : null;
      tag.coordinate = trilateration.getPosition(tag.epc, allAntennas, oldCoord, dt, tag.antennaRssis);
    }
  });
}

// remove all tags that only have timestamps larger than ancientAge
function purgeOldTags() {
  state.tagsData = _(state.tagsData).filter((tag) => {
    tag.antennaRssis = _(tag.antennaRssis).filter((antennaRssi) => {
      var isAncient = antennaRssi.age > shared.ancientAgeMs;
      if (isAncient) {
        util.log('Purging signal for antenna ' + antennaRssi.antNr + ' for tag ' +tag.epc);
      } else {
        //util.log('Not purging signal for antenna ' + antennaRssi.antNr + ' for tag ' +tag.epc + ' age: '+antennaRssi.age);
      }
      return !isAncient; 
    });
    var isTagRecent = tag.antennaRssis.length > 0;
    if (!isTagRecent) {
      util.log('Purging tag '+tag.epc);
    } 
    return isTagRecent;
  });
}

function signalPresentationServer(serverIp : string, antennaIndex : number, epc : string) {
  //util.log(new Date() + ' Signaling presentation server %s on antenna %d for tag %s', serverIp, antennaIndex, epc);
  var presentationServerSocket = new net.Socket();
  
  presentationServerSocket.on('data', function(buffer : NodeBuffer) {
    var response = buffer.toString('utf8');
    util.log('Presentation server on '+serverIp+': ' +  (response == 'ok\n' ? 'Presentation server was signaled on antenna '+antennaIndex : 'Error from presentation server: ' + response));
    presentationServerSocket.end();
  });
  presentationServerSocket.on('connect', function() {
    presentationServerSocket.write('epc=' + epc + '&antennaIndex=' + antennaIndex);
  });
  presentationServerSocket.on('error', function(err : any) { // TODO: not typed
    util.log('Connection to presentation server at ' + serverIp + ' failed (error code: ' + err.code + ')');
    if (presentationServerSocket) 
      presentationServerSocket.destroy();
  });
  presentationServerSocket.on('close', function() {
    //util.log('Connection closed');
  });

  presentationServerSocket.connect(presentationServerPortNr, serverIp);
}

// return the index in allAntennas for the antenna with id ant 
function getAntennaNr(antennaId : Shared.AntennaId) {
  for (var i = 0; i < allAntennas.length; i++) {
    if (allAntennas[i].antennaId.readerIp == antennaId.readerIp && allAntennas[i].antennaId.antennaNr == antennaId.antennaNr)
      return i;
  }
  return -1;
}

// Only allow letters, digits, and slashes
function isSafeFilePath(filePath : string) : boolean {
  return /^[a-zA-Z0-9" "\(\)\-\_]+$/.test(filePath);
}

function mkUniqueFilePath(fullFilePath : string, success : (uniqueFilePath : string) => any) {
  var pathNameArr = fullFilePath.match(/(.*)\/([^\/]*$)/); // split on last /
  if (!pathNameArr || pathNameArr.length != 3) { // [fullFilePath, path, name]   
  } else {
    var filePath = pathNameArr[1];
    var filenameExt = pathNameArr[2];
    var nameExtArr = filenameExt.match(/(.*)\.([^\.]*$)/); // split on last .
    var filename : string;
    var ext : string;
    if (nameExtArr && nameExtArr.length == 3) {
      filename = nameExtArr[1];
      ext = '.'+nameExtArr[2];
    } else {
      filename = filenameExt;
      ext = '';
    }
    fs.readdir(pathNameArr[1], (err, files) => {
      if (err) {
        util.error('Error on readdir in mkUniqueFilename: ' + err);
      } else {
        util.log(files, filename, ext);
        if (!(_(files).contains(filename + ext))) 
          success(fullFilePath); // the suggested name does not already exist
        else {
          var filenameIndexed : string;
          var i = 1;
          do { // try a higher index until the name is not in the directory
            filenameIndexed = filename + ' (' + i++ + ')' + ext;
            util.log('filenameIndexed' + filenameIndexed);
          } while (_(files).contains(filenameIndexed))
          success( filePath + '/' + filenameIndexed);
        }  
      }
    });
  }
}
