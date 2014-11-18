/*******************************************************************************/
/* LucyServer.ts                                                               */
/*                                                                             */
/* Copyright (c) 2014, Martijn Schrage - Oblomov Systems. All Rights Reserved. */
/*                                                                             */
/*******************************************************************************/

/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/express/express.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="./File.ts" />
/// <reference path="./Trilateration.ts" />
/// <reference path="./Config.ts" />
/// <reference path="../shared/Shared.ts" />
/// <reference path="./ServerCommon.ts" />

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
import File          = require('./File');  
import Session       = require('./Session');
import trilateration = require('./Trilateration');
import Config        = require('./Config');
import ServerCommon  = require('./ServerCommon');
var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails

// Libraries without TypeScript definitions:

var mysql            = require('mysql');
var lineByLineReader = require('line-by-line');
var app = express();

// global state variables

var state : Shared.ServerState;
var dynamicConfig : Shared.DynamicConfig; // read from file on initialize and query/upload-config handler
var allAntennaLayouts : Shared.AntennaLayout[];
var allAntennas : Shared.Antenna[];

var readerServerSocket : net.Socket;
var eventLogAutoSaveStream : ServerCommon.AutoSaveStream; // for logging all reader events
var tagPositionAutoSaveStream : ServerCommon.AutoSaveStream; // for logging all computed tag positions
var outputFileStream : fs.WriteStream; // for explicitly saving reader events

var readerServerHostName : string;
var serverPortNr : number;

var dbConnectionPool : any;

var reportShortMidRangeTimer : NodeTimer;
var positioningTimer : NodeTimer;
var positionSaveIntervalElapsed = 0; // counter that allows position save to be done in positioning timer

// For now, we have just one replay session, until this object is associated with an http session
var theReplaySession : Shared.ReplaySession = { fileReader: null, startClockTime: null, startEventTime: null 
                                              , tagsState: {mostRecentEventTimeMs: null, previousPositioningTimeMs: null, tagsData: []} 
                                              };


initServer();

function initServer() {
  // usage: LucyServer [portNr] [--remoteReader]
  var portArg = parseInt(process.argv[2]);
  serverPortNr = portArg || Config.defaultServerPortNr;
  
  if (process.argv[2] == '--remoteReader' || portArg && process.argv[3] == '--remoteReader') {
    // use remoteReader to connect to reader server on lucy.oblomov.com instead of localhost 
    readerServerHostName = Config.remoteHostName;
    Config.db_config.host = 'localhost';
//    Config.db_config.host = '10.0.0.20'; // select this line when we run on the Lucy network (or VPN) and want to use the Synology MySQL server
  } else {
    readerServerHostName = "localhost";
  }
  dbConnectionPool = mysql.createPool(Config.db_config);
  
  util.log('\n\n');
  ServerCommon.log('Starting Lucy server on port ' + serverPortNr + ', using reader server on ' + readerServerHostName + '\n\n');
  
  dynamicConfig = Config.getDynamicConfig();
  
  allAntennaLayouts = Config.getAllAntennaLayouts();
  resetServerState();
 
  eventLogAutoSaveStream = Config.initEventLogAutoSaveStream;
  tagPositionAutoSaveStream = Config.initTagPositionAutoSaveStream;
  
  reportShortMidRangeTimer = <any>setInterval(reportShortMidRangeData, Config.reportShortMidRangeInterval); // annoying cast beacause of Eclipse TypeScript
  positioningTimer = <any>setInterval(positionAllTags, dynamicConfig.positioningInterval); // annoying cast beacause of Eclipse TypeScript

  initExpress();
  var server = app.listen(serverPortNr, () => { util.log('Web server listening to port ' + serverPortNr);});
}


function resetServerState() {
  state = shared.initialServerState();
  disconnectReader();
  connectReaderServer();
  initAntennaLayout(state.selectedAntennaLayoutNr);
  util.log('Resetting server state');
}

function initExpress() {
  app = express();

  app.enable('trust proxy'); // Need this to get correct ip address when redirecting from lucy.oblomov.com

  app.use(express.compress());
  app.use(express.cookieParser());
  app.use(express.session(Session.expressSessionOptions));

  app.use('/', (req : express.Request, res : express.Response, next:()=>void)=>{
    var session = Session.getOrInitSession(req);
    session.lastAccess = new Date();
    
    //util.log(new Date() + session.sessionId + ' Nr of sessions: '+Session.getNrOfSessions());
    next();
  });
  // serve 'client', 'shared', and 'node-modules' directories, but not 'server'
  app.use('/js/client', express.static(__dirname + '/../client'));
  app.use('/js/shared', express.static(__dirname + '/../shared'));
  app.use('/js/node_modules', express.static(__dirname + '/../node_modules'));
  app.use('/data', express.directory(Config.lucyDataDirectoryPath));
  app.use('/data', express.static(Config.lucyDataDirectoryPath));
  app.use('/logs', express.directory(Config.lucyLogDirectoryPath)); // TODO: require authorization
  app.use('/logs', express.static(Config.lucyLogDirectoryPath)); // TODO: require authorization
  app.use('/saved-positions', express.directory(Config.savedPositionsDirectoryPath)); // TODO: require authorization
  app.use('/saved-positions', express.static(Config.savedPositionsDirectoryPath)); // TODO: require authorization
  app.get('/', function(req, res) { res.redirect('/locator.html'); }); // redirect '/' to '/locator.html'
  app.use(express.static(__dirname + '/../../www')); //  serve 'www' directory as root directory

  //app.use(express.logger()); 
  app.use(function(req : express.Request, res : express.Response, next : Function) { // logger only seems to report in GMT, so we log by hand
    var now = new Date();
    var userAgent = req.headers['user-agent'] ? '"' + req.headers['user-agent'].slice(0,20) + '.."' : '<Unknown user agent>';
    util.log('\nRQ: ' + util.showDate(now) + ' ' + util.showTime(now) + 
             ' (' + req.ip + ', ' + userAgent +') path:' + req.path);
    next();
  });

  app.get('/query/version', function(req, res) {  
    child_pr.exec( Config.cercandoGitDirectory + '/scripts/generateGitInfo.sh'
                 , {cwd: '../..'}
                 , function(error, stdout, stderr) { 
                     res.setHeader('content-type', 'application/json');
                     res.send(stdout); 
                   } );
  });

  app.get('/query/login', function(req, res) {
    res.setHeader('content-type', 'application/json');
    var username = req.query.username;
    var password = req.query.password;
    
    Session.login(req, username, password, loginResponse => {
      res.send(JSON.stringify(loginResponse));
    });
  });    

  app.get('/query/logout', function(req, res) {
    res.setHeader('content-type', 'application/json');
        
    Session.logout(req);

    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });    

  app.get('/query/view-config', Session.requireAuthorization(), function(req, res) {  
    res.setHeader('content-type', 'text/html');    
    var html = 'Current dynamic Lucy configuration:<br/><br/>';

    var result = File.readConfigFile(Config.lucyConfigFilePath);
    if (result.err) {
      html += '<span style="color: red">ERROR: Reading configuration from Synology NAS ('+Config.lucyConfigFilePath+') failed:</span><br/>';
      html += '<pre>' + result.err + '</pre>';
    } else {
      html += '<tt>' + JSON.stringify(result.config) + '</tt>';
      html += '<br/><br/>Meaning of fields:<br/><pre>';
      // NOTE:  keep this documentation in sync with explanation in Shared.ts at export interface DynamicConfig
      html += 'positioningInterval : number  // time in ms between computing coordinates of all tags (and purging old signals/tags)\n'
            + 'positionSaveInterval : number // keep this a multiple of positioningInterval to keep time between saves constant (save is only done on positioning)\n'
            + 'smootherRC : number           // filter constant for smoother\n'
            + 'staleAgeMs : number           // time before antenna signal is no longer used for positioning\n'
            + 'ancientAgeMs: number          // time before tag is purged\n'
            + 'walkingSpeedKmHr : number     // maximum assumed movement speed of (carriers of) tags\n'
            + 'shortMidRangeSpecs : ShortMidRangeSpec[] // array of short/mid-range specifications\n\n'
            + 'interface ShortMidRangeSpec { antennaName : string; isShortRange : boolean; serverIp : string }'
      html += '</pre><br/><br/><input type="button" onclick="history.go(-1);" value="&nbsp;&nbsp;Ok&nbsp;&nbsp;"></input>';
    }
    res.send(html);
  });

  app.get('/query/upload-config', Session.requireAuthorization(), function(req, res) {  
    // TODO: require authentication
    res.setHeader('content-type', 'text/html');
    var html = '';
    var result = File.readConfigFile(Config.configUploadFilePath);
    if (result.err) {
      html += '<span style="color: red">ERROR: Uploading new configuration from Synology NAS ('+Config.configUploadFilePath+') failed:</span><br/>';
      html += '<pre>' + result.err + '</pre>';
    } else {
      try {
        fs.unlinkSync(Config.configUploadFilePath); // remove upload file, so we won't confuse it with the current config
      } catch(err) {
        html += '<span style="color: red">ERROR: Failed to remove upload file: /web/lucyData/configUpload/config.json</span>';
        html += '<pre>' + err + '</pre>';
        html += 'Please remove the file manually.<br/><br/>';
      } // failed removal is not fatal, so we continue
      
      File.writeConfigFile(Config.lucyConfigFilePath, result.config); // write the new config to the local config file
      dynamicConfig = Config.getDynamicConfig();                      // and update dynamicConfig
      // restart interval according to current interval from uploaded config
      clearInterval(<any>positioningTimer);
      positioningTimer = <any>setInterval(positionAllTags, dynamicConfig.positioningInterval); // annoying cast beacause of Eclipse TypeScript

      initAntennaLayout(state.selectedAntennaLayoutNr); // incorporate new short/mid-range specs in antennaLayout
      html += 'Succesfully uploaded short/mid-range configuration from Synology NAS to Lucy server:<br/><br/>';
      html += '<tt>' + JSON.stringify(result.config) + '</tt>';
    } 
    html += '<br/><br/><input type="button" onclick="history.go(-1);" value="&nbsp;&nbsp;Ok&nbsp;&nbsp;"></input>';
    res.send(html);
  });

  app.get('/query/tags', function(req, res) {
    //util.log('Sending tag data to client. (' + new Date() + ')');
    //util.log('Session id: '+(<any>req.session).id);
    res.setHeader('content-type', 'application/json');


    var session = Session.getOrInitSession(req);

    var tagsServerInfo : Shared.TagsServerInfo =
      { tagsInfo: { mostRecentEventTimeMs: session.tagsState.mostRecentEventTimeMs
                  , tagsData: _(session.tagsState.tagsData).filter(tagData => {return tagData.coordinate != null}) // don't send tags that don't have a coordinate yet
                  } 
      , serverInfo: { staleAgeMs: dynamicConfig.staleAgeMs
                    , ancientAgeMs: dynamicConfig.ancientAgeMs
                    , selectedAntennaLayoutNr: state.selectedAntennaLayoutNr // TODO: move to SessionState
                    , unknownAntennaIds: state.unknownAntennaIds // TODO: move to SessionState
                    , status: state.status
                    , diColoreStatus: state.diColoreStatus
                    }
      , sessionInfo: Session.getSessionInfo(req) // TODO: maybe create this one from session directly
      }
    res.send(JSON.stringify(tagsServerInfo));
  });

  app.get('/query/layout-info', function(req, res) {  
    util.log('Sending layout info to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    var layoutInfo : Shared.LayoutInfo =
      {selectedLayoutNr: state.selectedAntennaLayoutNr, names: _(allAntennaLayouts).pluck('name')}
    res.send(JSON.stringify(layoutInfo));
  });
  
  app.get('/query/select-layout/:nr', function(req, res) { // return AntennaInfo object for new selection  
    // TODO: require authentication (needs some refactoring first)
    util.log('Selecting antenna layout '+req.params.nr+': '+allAntennaLayouts[req.params.nr].name +
             ',  sending antenna data to client. (' + new Date() + ')');
    initAntennaLayout(req.params.nr);
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify( getAntennaInfo(req.params.nr) ));
  });
  
  app.get('/query/connect', Session.requireAuthorization(), function(req, res) {  
    util.log('connect');
    connectReaderServer();
    res.setHeader('content-type', 'text/plain'); 
    // set content-type, otherwise jQuery infers JSON, and produces an error that is sometimes incorrectly located in other libraries
    res.writeHead(204);
    res.end();
  });

  app.get('/query/disconnect', Session.requireAuthorization(), function(req, res) {  
    util.log('disconnect');
    disconnectReader();
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });

  app.get('/query/reset', Session.requireAuthorization(), function(req, res) {
    util.log('reset');
    resetServerState();
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });

  app.get('/query/start-saving', Session.requireAuthorization(), function(req, res) {
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
  
  app.get('/query/stop-saving', Session.requireAuthorization(), function(req, res) {
    util.log('Stop-saving request');
    stopSaving();
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });

  app.get('/query/replay-info', function(req, res) {  
    util.log('Sending replay info to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    ServerCommon.log('Getting replay directory structure')
    var replayInfo : Shared.ReplayInfo =
      { contents: File.getRecursiveDirContents(Config.saveDirectoryPath) }; 
      //{ contents: [ { name: '7', contents: [ { name: '1', contents: [{name: '10.45', contents: []}, {name: '11.00', contents: []}] }, { name: '2', contents: [{name: '11.45', contents: []}, {name: '12.00', contents: []}] } ] }
      //            , { name: '8', contents: [ { name: '3', contents: [{name: '13.45', contents: []}, {name: '14.00', contents: []}] }, { name: '4', contents: [{name: '14.45', contents: []}, {name: '15.00', contents: []}] } ] }
      //            ] }
    res.send(JSON.stringify(replayInfo));
  });

  app.get('/query/start-replay', Session.requireAuthorization(), function(req, res) {
    var fileName = req.query.filename + '.csv';
    
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
    util.log(new Date() + ' Start-replay request\nFile: "' + decodeURI(req.query.filename + '"') + 
             '\nOriginating IP: ' + req.ip + '  user-agent: '+ (req.headers['user-agent'] ? '"' + req.headers['user-agent'].slice(0,20) + '.."' : '<Unknown user agent>'));
    startReplay(theReplaySession, decodeURI(req.query.filename), cont);
  });

  app.get('/query/stop-replay', Session.requireAuthorization(), function(req, res) {
    util.log('Stop-replay request');
    stopReplay(theReplaySession);
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

// set allAntennas by taking the layout specified by nr and combining it with the current shortMidRangeSpecs.
function initAntennaLayout(nr : number) {
  state.selectedAntennaLayoutNr = util.clip(0, allAntennaLayouts.length-1, nr);
  allAntennas = ServerCommon.mkReaderAntennas(allAntennaLayouts[state.selectedAntennaLayoutNr], dynamicConfig.shortMidRangeSpecs);
  state.liveTagsState.tagsData = [];
  theReplaySession.tagsState.tagsData = [];
  state.unknownAntennaIds = [];
  state.diColoreStatus.shortMidRangeServers = _(dynamicConfig.shortMidRangeSpecs).map(spec => {
    return {antennaName: spec.antennaName, operational: false};
  });
}

function getAntennaInfo(nr : number) : Shared.AntennaInfo {
  var antennaLayout = allAntennaLayouts[nr];
  var info  = { name: antennaLayout.name
              , backgroundImage: antennaLayout.backgroundImage
              , backgroundSize: antennaLayout.backgroundSize
              , backgroundOrigin: antennaLayout.backgroundOrigin
              , backgroundScale: antennaLayout.backgroundScale
              , screenZoomFactor: antennaLayout.screenZoomFactor
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
    ServerCommon.log('Connection to reader server failed (error code: ' + err.code + '), retrying..');
    if (readerServerSocket) 
      readerServerSocket.destroy();
  });
  readerServerSocket.on('close', function() {
    ServerCommon.log('Connection closed');
    destroySocketAndRetryConnection();
  });

  ServerCommon.log('Trying to connect to reader server on '+readerServerHostName+':'+Config.readerServerPortNr);
  readerServerSocket.connect(Config.readerServerPortNr, readerServerHostName);
}

function destroySocketAndRetryConnection() {
  state.status.isConnected = false;
  if (readerServerSocket) 
    readerServerSocket.destroy(); // destroy socket if it wasn't already destroyed, just to make sure
  readerServerSocket = null;
  
  ServerCommon.log('Connection to reader server lost, reconnecting..');
  setTimeout(function() { // automatically try to reconnect
    connectReaderServer();
  }, Config.reconnectInterval);
}

// Helper function to show \0 and \ufffd characters.
function showInvisibles(str : string) {
  return str.replace('\0','\\0').replace('\ufffd','\\ufffd');
}

function readerServerConnected(readerServerSocket : net.Socket) {
  state.status.isConnected = true;
  ServerCommon.log('Connected to reader server at: ' + readerServerHostName + ':' + Config.readerServerPortNr);
  
  // raw data listener
  var lineBuffer = '';
  readerServerSocket.on('data', function(buffer : NodeBuffer) {
    var chunk : string = buffer.toString('utf8');
    //util.log('CHUNK:\n'+showInvisibles(chunk));
  
    chunk = chunk.replace(/\0/g,''); // Remove \0 characters added by Java  
    
    var lines = chunk.split('\n'); // reader events are terminated by a newline 
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
          processReaderServerEvent(readerEvent);
      }
    }
    lineBuffer += lastLine;
  });
}

function startSaving(filePath : string, cont : {success : () => void; error : (message : string) => void}) {
  if (!File.isSafeFilePath(filePath))
    cont.error('Invalid file path: "'+filePath+'"\nMay only contain letters, digits, spaces, and these characters: \'(\' \')\' \'-\' \'_\'');
  else {
    var fullFilename = Config.userSaveDirectoryPath + '/' + filePath+'.csv';
    File.mkUniqueFilePath(fullFilename, (uniqueFilePath) => {
      outputFileStream = fs.createWriteStream(uniqueFilePath);
      outputFileStream.on('error', function(err : Error) {
        util.log('Start-saving failed: ' + err.message);
        cont.error(err.message);
      });
      outputFileStream.once('open', function(fd :  number) {
        state.status.isSaving = true;
         
        outputFileStream.write(File.eventLogHeader);
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

function outputStreamWriteReaderEvent(outputStream : fs.WriteStream, readerEvent : ServerCommon.ReaderEvent) {
  var months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  var readerTimestamp = new Date(new Date(readerEvent.timestamp).getTime());
  var date = months[readerTimestamp.getMonth()]+'-'+readerTimestamp.getDate()+'-'+readerTimestamp.getFullYear();
  var time = readerTimestamp.getHours() + ':' + util.padZero(2,readerTimestamp.getMinutes()) + ':'
           + util.padZero(2,readerTimestamp.getSeconds()) + ':' + util.padZero(3,readerTimestamp.getMilliseconds());

  // Mimic the save format created by Motorola SessionOne app, but add the reader ip in an extra column (ip is not saved by SessionOne)
  // NOTE: we write the time in milliseconds (3 digits) rather than SessionOne's silly 4 digit tenths of milliseconds. 
  var eventStr = '\'0'+readerEvent.epc+', '+time+', '+date+', '+readerEvent.ant+', '+readerEvent.rssi+', , , , , '+readerEvent.readerIp;  
  //console.log(eventStr);
  outputStream.write(eventStr + '\n');
}

// NOTE: filename is based on current time, not on event time, so at the start, a log file may contain some events older than the time in the filename 
function logReaderEvent(readerEvent : ServerCommon.ReaderEvent) {
  File.updateAutoSaveStream(eventLogAutoSaveStream);
  outputStreamWriteReaderEvent(eventLogAutoSaveStream.outputStream, readerEvent);
}


// Replay functionality

// TODO line-by-line is also buggy: async processing according to https://www.npmjs.org/package/line-by-line stops at the start of the last
// chunk, meaning we lose the last 5 seconds of each replay and cannot replay files under 5 seconds (determined by nr of lines, so actual time may vary) 
// TODO Quickly tapping the start-replay button hangs Firefox. Chrome is fine though. 
// Note: filePath is relative to saveDirectoryPath and without .csv extension
function startReplay(replaySession : Shared.ReplaySession, filePath : string, cont : {success : () => void; error : (message : string) => void}) {
  if (!File.isSafeFilePath(filePath.replace(/[\/,\.]/g,''))) { // first remove / and ., which are allowed in replay file paths
    // This is safe as long as we only open the file within the server and try to parse it as csv, when csv can be downloaded we need stricter
    // safety precautions.
    cont.error('Invalid file path: "'+filePath+'"\nMay only contain letters, digits, spaces, and these characters: \'(\' \')\' \'-\' \'_\'  \'/\'  \'.\'');
  } else {
    var replayFilePath = Config.saveDirectoryPath + '/' + filePath + '.csv';

    if (!fs.existsSync( replayFilePath )) { 
      // Check file existence beforehand, since we cannot use cont.error() after the lineReader has been created (creation 
      // succeeds even for missing file and only calls the error callback afterwards).
      var err = 'Error: Replay file does not exist: '+ replayFilePath;
      util.log(err);
      cont.error(err);
    } else {
      // Because line-by-line does not distinguish automatic close (after error or eof) from user-initiated close, and the 'end' event
      // is emited after a delay, we need to disable 'end' handling, since otherwise the new file reader will be cleared at this event.
      if (replaySession.fileReader) {
        replaySession.fileReader.removeAllListeners('end');    
        replaySession.fileReader.close();
        clearReplay(replaySession);
      }
      
      replaySession.tagsState.tagsData = [];
      state.status.replayFileName = filePath;

      // TODO: drop header line more elegantly
      var lineReader = new lineByLineReader(replayFilePath);
      
      replaySession.fileReader = lineReader;
      
      lineReader.on('error', (err : Error) => {
        //clearReplay();
        util.error('lineReader: error while reading \'' + filePath + '\'');
        util.error(err);
      });
      
      lineReader.on('line', (line : string) => {
        //util.log('line');
        lineReader.pause(); // replayFileReader is resumed by readReplayEvent()
        readReplayEvent(replaySession, line, lineReader);
      });
        
      lineReader.on('end', () => {
        util.log('Ending replay'); // TODO: apparently called several times
        clearReplay(replaySession);
      });
      cont.success();
    }
  }
}

function stopReplay(replaySession : Shared.ReplaySession) {
  if (replaySession.fileReader)
    replaySession.fileReader.close();
}

function clearReplay(replaySession : Shared.ReplaySession) {
  replaySession.fileReader = null;
  replaySession.tagsState.tagsData = [];
  state.status.replayFileName = null;
  replaySession.startClockTime = null;
  replaySession.startEventTime = null;
}

function readReplayEvent(replaySession : Shared.ReplaySession, line : string, lineReader : any) {
  //util.log('Read replay line: ' + line);
  var replayEvent = parseReplayEventCSV(line);
  if (!replayEvent) {
    lineReader.resume();
  } else {
    var replayEventTime = new Date(replayEvent.timestamp).getTime();
    if (!replaySession.startClockTime) { // This means we're reading the first event
      replaySession.startClockTime = new Date().getTime();
      replaySession.startEventTime = replayEventTime;
      //util.log('Replay first event timestamp: ' + new Date(replayEventTime));
      replaySession.tagsState.tagsData = [];
    }
    
    var replayEventRelativeTime = new Date(replayEvent.timestamp).getTime() - replaySession.startEventTime;
    var replayEventClockTime = replaySession.startClockTime + replayEventRelativeTime;
    var eventDelay = util.clip(0, Number.MAX_VALUE, replayEventClockTime - new Date().getTime());
    //util.log(replayEventRelativeTime + '  ' + eventDelay);

    //util.log('Emit event: ' + JSON.stringify(replayEvent));
    processReaderEvent(replaySession.tagsState, replayEvent);
    
    setTimeout(() => {
      lineReader.resume();
    }, eventDelay);
  }      
}

// NOTE: we assume the fields do not contain commas, so every comma is a separator
function parseReplayEventCSV(csvLine : string) : ServerCommon.ReaderEvent {
  var values = _(csvLine.split(',')).map(rawField => {return rawField.replace(/^ /,'')});
  
  if (values.length != 10) {
    util.error('Error: csv line has incorrect nr. of fields ('+values.length+'):\n' + csvLine);
    return null;
  } else {
    // check format of fields, originally introduced to deal with buggy read-line package, but still useful as an extra check for correctness
    if (!(   /^'[0-9a-zA-Z]+$/.test(values[0])                  // [ "'005355d0000000000017c48" 
          && /^\d\d:\d\d:\d\d:\d\d\d$/.test(values[1])          // , "14:24:13:098" 
          && /^[a-z][a-z][a-z]\-\d+\-\d\d\d\d$/.test(values[2]) // , "jul-8-2014"
          && /^\d+$/.test(values[3])                            // , "2"
          && /^\-\d+$/.test(values[4])                          // , "-60"
          && /^$/.test(values[5]) && /^$/.test(values[6]) && /^$/.test(values[7]) && /^$/.test(values[8]) // , "", "", "", "" 
          && /^\d+\.\d+\.\d+\.\d+$/.test(values[9])             // , "10.0.0.32" ]
         )) {
      util.error('Error: csv line has an incorrect fields:\n' + csvLine);
      return null;
    } else {
      var date = new Date(values[2]); 
      var timestamp =  
        util.padZero(4, date.getFullYear()) + '-' + util.padZero(2, date.getMonth()+1) + '-' + util.padZero(2, date.getDate()) +
        ' ' + values[1];
      return {readerIp: values[9], ant: parseInt(values[3]), epc: ''+values[0].slice(2), rssi: parseInt(values[4]), timestamp: timestamp};
    }
  } // epc slice(2) to drop the "'0" in front of the epc (added by SessionOne)
}

// Process ReaderEvent coming from a reader server (not from a replay)
function processReaderServerEvent(readerEvent : ServerCommon.ReaderEvent) {
  if (false && readerEvent.readerIp=='10.0.0.31' && readerEvent.ant == 3) // '10.0.0.30-33'  A=30, B=31, C=32, D=33, e.g. 10.0.0.31:3 = B3  
    util.log('Reader event: ' + JSON.stringify(readerEvent));
   
  logReaderEvent(readerEvent);
  processReaderEvent(state.liveTagsState, readerEvent);
}

// Process ReaderEvent, possibly coming from a replay
function processReaderEvent(tagsState : Shared.TagsState, readerEvent : ServerCommon.ReaderEvent) {
  var timestamp = new Date(readerEvent.timestamp);
  tagsState.mostRecentEventTimeMs = timestamp.getTime();
  //ServerCommon.log('Reader event: ' + JSON.stringify(readerEvent));
  if (outputFileStream) {
    outputStreamWriteReaderEvent(outputFileStream, readerEvent);
  }

  var tag = _.findWhere(tagsState.tagsData, {epc: readerEvent.epc});
  if (!tag) {
    tag = { epc:readerEvent.epc, antennaRssis: [], metaData: null }
    tagsState.tagsData.push(tag);
    tagDidEnter(tag);
  }
    
  
  var antennaId : Shared.AntennaId = {readerIp: readerEvent.readerIp, antennaNr: readerEvent.ant };
  var antNr = getAntennaNr(antennaId);
  if (antNr == -1) { // The antenna is not part of the current antenna configuration.
    if (!_(state.unknownAntennaIds).find((unknownId) => { 
        return _.isEqual(unknownId, antennaId);})) {
      state.unknownAntennaIds.push(antennaId);
    }
  } else {
    var oldAntennaRssi = getAntennaRssiForAntNr(antNr, tag.antennaRssis);
    
    var newRssi = !Config.useSmoother ? readerEvent.rssi 
                                      : filtered(readerEvent.epc, readerEvent.readerIp, readerEvent.ant, readerEvent.rssi, timestamp, oldAntennaRssi);

    var distance = trilateration.getDistanceForRssi(tag.epc, allAntennas[antNr].name, newRssi);
    var newAntennaRssi : Shared.AntennaRSSI = {antNr: antNr, value: newRssi, timestamp: timestamp, distance: distance, age: 0};
    //if (readerEvent.epc == '0000000000000000000000000503968' && readerEvent.ant == 1) {
    //  util.log(new Date().getSeconds() + ' ' + readerEvent.epc + ' ant '+readerEvent.ant + ' rawRssi: '+readerEvent.rssi.toFixed(1) + ' dist: '+
    //          trilateration.getDistanceForRssi(readerEvent.epc, ''+readerEvent.ant, readerEvent.rssi));
    //}
    
    updateAntennaRssi(newAntennaRssi, tag.antennaRssis);
    //trilateration.getDistanceForRssi(readerEvent.ePC, readerEvent.ant, readerEvent.RSSI);
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
function filtered(epc : string, readerIp : string, ant : number, rssi : number, timestamp : Date, previousAntennaRssi : Shared.AntennaRSSI) {
  var RC = dynamicConfig.smootherRC;

  // dT based on event time
  var dT = (previousAntennaRssi ? timestamp.getTime() - previousAntennaRssi.timestamp.getTime() : 100)/1000;
  var previousRssi = previousAntennaRssi ? previousAntennaRssi.value : rssi;
  
  var alpha = dT / (dT + RC);
  var newRssi = rssi * alpha + previousRssi * (1.0 - alpha);
  //if (epc == '0000000000000000000000000503968' && ant == 1) {
  //  util.log(new Date().getSeconds() + ' ' + epc + ' ant '+ant + ' prevRssi: '+previousRssi.toFixed(1) + ' rawRssi: '+rssi.toFixed(1) + ' newDist: '+
  //           trilateration.getDistanceForRssi(epc, ''+ant, newRssi).toFixed(1) + ' newRssi: '+newRssi.toFixed(1));
  //}
  if (false && readerIp=='10.0.0.31' && ant == 3 // '10.0.0.30-33'  A=30, B=31, C=32, D=33, e.g. 10.0.0.31:3 = B3  
            && epc == '0000000000000000000000000000000') { // '0000000000000000000000000000000' is yellow in simulator
    util.log(epc + ':' + ant + ' ' + JSON.stringify(newRssi) );
  }
  //util.log(util.padZero(3,dT) + JSON.stringify(previousRssi) );
  //util.log(util.padZero(3,dT) + JSON.stringify(previousRssi.value) );
  return newRssi;
}


// Di Colore communication

// type-safe shorthand function
function messageDiColoreTagDistances(serverIp : string, serverPort : number, tagDistances : Shared.DiColoreTagDistances) {
  messageDiColoreServer(serverIp, serverPort, tagDistances, successful => {
    var shortMidRangeStatus = _(state.diColoreStatus.shortMidRangeServers).findWhere({antennaName: tagDistances.antennaName});
    if (shortMidRangeStatus) {
      shortMidRangeStatus.operational = successful;
    } else {
      util.error('Internal error: shortMidRange status object not found for antenna: ' + tagDistances.antennaName);
    }
  });}

// type-safe shorthand function
function messageDiColoreTagLocations(serverIp : string, serverPort : number, tagLocations : Shared.DiColoreTagLocations) {
  //util.log('message Di Colore'+JSON.stringify(tagLocations));
  messageDiColoreServer(serverIp, serverPort, tagLocations, successful => {
    state.diColoreStatus.locationServerOperational = successful;
  });
}
 
function messageDiColoreServer(serverIp : string, serverPort : number, messageObject : any, callback : (successful : boolean) => void) {
  //util.log(new Date() + ' Messaging Di Colore server %s:%d', serverIp, serverPort);
  var presentationServerSocket = new net.Socket();
  
  // Failing connections don't cause an error event, so we need an explicit timeout to prevent opening too many sockets
  presentationServerSocket.setTimeout(Config.diColoreSocketTimeout, () => {
    presentationServerSocket.destroy(); // end() doesn't work if the socket is hanging on connect
  });
  presentationServerSocket.on('data', function(buffer : NodeBuffer) {
    var response = buffer.toString('utf8');
    if (response != 'ok\n') {
      //util.log('Error: Di Colore server at ' + serverIp + ':' + serverPort + ' failed to respond correctly:\n' + response);
      callback(false);
    } else
      callback(true);
    presentationServerSocket.end();
  });
  presentationServerSocket.on('connect', function() {
    presentationServerSocket.write( JSON.stringify(messageObject) );
  });
  presentationServerSocket.on('error', function(err : any) { // not typed
    //util.log('Connection to Di Colore server at ' + serverIp + ' failed (error code: ' + err.code + ')');
    callback(false);
    presentationServerSocket.end();
    if (presentationServerSocket) 
      presentationServerSocket.destroy();
  });
  presentationServerSocket.on('close', function() {
    //util.log('Connection closed');
  });

  presentationServerSocket.connect(serverPort, serverIp);
}

function reportShortMidRangeData() {
  // create sparse array for all antennas to store tags visible to each short-/midrange antenna
  // (using array for all antennas allows us to use the antennaNr as index)
  var allAntennaTags : { epc:string; rssi:number; distance:number}[][] = util.replicate(allAntennas.length, []);
  _(state.liveTagsState.tagsData).each(tag => {
    _(tag.antennaRssis).each(antRssi => {
      //util.log(tag.epc + ' ' + JSON.stringify(antRssi));
      if (allAntennas[antRssi.antNr].shortMidRange!=null && antRssi.age < 0.5) // TODO: use better way to clear short/mid faster than normal antennas, or use constant
        // TODO: age seems incorrect: always 0 except for the last entry  
        allAntennaTags[antRssi.antNr].push({epc: tag.epc, rssi: antRssi.value, distance: antRssi.distance});
    }); 
  });

  var shortMidTagss : { antennaName:string; shortMidRangeIp:string; tagDistances : { epc:string; rssi:number; distance:number}[] }[] = [];
    
  _(allAntennaTags).each((tagsInRange, antennaNr) => {
      if (allAntennas[antennaNr].shortMidRange != null) {
        shortMidTagss.push({antennaName: allAntennas[antennaNr].name, shortMidRangeIp: allAntennas[antennaNr].shortMidRange.serverIp, tagDistances: tagsInRange});
      }
  });

  _(shortMidTagss).each(shortMidTags => {
    var diColoreTagDistances :Shared.DiColoreTagDistances = {antennaName: shortMidTags.antennaName, tagDistances: shortMidTags.tagDistances};
    messageDiColoreTagDistances(shortMidTags.shortMidRangeIp, Config.diColoreShortMidPort, diColoreTagDistances);
  });
}

// Report all tag coordinates to Di Colore server
function reportTagLocations() {
  var tagLocations : {epc:string; x:number; y:number}[] = [];
  _(state.liveTagsState.tagsData).each(tag => {
      if (tag.coordinate) { // in case no location was computed yet
        tagLocations.push({epc: tag.epc, x:+tag.coordinate.coord.x.toFixed(2), y:+tag.coordinate.coord.y.toFixed(2)}) 
      }
  });
  var now = new Date();
  var diColoreTagLocations : Shared.DiColoreTagLocations = { timestamp: util.showDate(now) + ' ' + util.showTime(now), tagLocations: tagLocations}
  messageDiColoreTagLocations(Config.diColoreLocationServer.ip, Config.diColoreLocationServer.port, diColoreTagLocations);
}

function positionAllTags() {
  Session.pruneSessions();
  positionTags(state.liveTagsState);

  // use positionSaveIntervalElapsed to only save when the entire positionSaveInterval has elapsed
  positionSaveIntervalElapsed += dynamicConfig.positioningInterval;
  if (positionSaveIntervalElapsed >= dynamicConfig.positionSaveInterval) {
    positionSaveIntervalElapsed %= dynamicConfig.positionSaveInterval; 
    File.saveTagPositions(tagPositionAutoSaveStream, state.liveTagsState);
  }
  
  reportTagLocations();
 
  Session.eachSession(session => {
    //util.log('assigning tagsState for session '+session.sessionId);
    session.tagsState = state.liveTagsState;
  });
  
//  if (theReplaySession.fileReader) { // TODO: wrong condition
//    positionTags(theReplaySession.tagsState);
//  }
}

// trilaterate all tags in tagsInfo and set age and distance for each rssi value
function positionTags(tagsState : Shared.TagsState) {
  var positioningTimeMs = new Date().getTime(); // dt based on actual time
  var dt = tagsState.previousPositioningTimeMs ? (positioningTimeMs - tagsState.previousPositioningTimeMs) / 1000 :  0
  tagsState.previousPositioningTimeMs = positioningTimeMs; 

  // set the age for each antennaRssi for each tag
  _(tagsState.tagsData).each((tag) => {
    //util.log(tag.epc + ':' + tag.antennaRssis.length + ' signals');
    _(tag.antennaRssis).each((antennaRssi) => {
      antennaRssi.age = tagsState.mostRecentEventTimeMs - antennaRssi.timestamp.getTime();
    });
  });
  
  purgeOldTags(tagsState);  
  
  // compute coordinate for each tag
  _(tagsState.tagsData).each((tag) => {
    var shortMidRangeRssi = _(tag.antennaRssis).find((antennaRssi) => {
      var shortMidRange = allAntennas[antennaRssi.antNr].shortMidRange;
      return shortMidRange != null && shared.isRecentAntennaRSSI(dynamicConfig.staleAgeMs, antennaRssi);
    });
    if (shortMidRangeRssi && shortMidRangeRssi.value > shared.shortMidRangeRssiThreshold) {
      //util.log('short mid for tag '+tag.epc);
      tag.coordinate = {coord: allAntennas[shortMidRangeRssi.antNr].coord, isRecent:true};
    } else { // TODO: don't use short/mid-range antennas for trilateration
      var oldCoord = tag.coordinate ? tag.coordinate.coord : null;
      tag.coordinate = trilateration.getPosition(dynamicConfig, allAntennas, tag.epc, oldCoord, dt, tag.antennaRssis);
      if (false && tag.epc == '0000000000000000000000000000001') { // '0000000000000000000000000000000' is yellow in simulator
        util.log(util.replicate((tag.coordinate.coord.x-4) *10, '#').join(''));
        //util.log('Computed coordinate: '+JSON.stringify(tag.coordinate));
      }

    }
  });
}

// remove all tags that only have timestamps larger than ancientAge
function purgeOldTags(tagsState : Shared.TagsState) {
  tagsState.tagsData = _(tagsState.tagsData).filter((tag) => {
    tag.antennaRssis = _(tag.antennaRssis).filter(antennaRssi => {
      var isAncient = antennaRssi.age > dynamicConfig.ancientAgeMs;
      if (isAncient) {
        //util.log('Purging signal for antenna ' + antennaRssi.antNr + ' for tag ' +tag.epc);
      } else {
        //util.log('Not purging signal for antenna ' + antennaRssi.antNr + ' for tag ' +tag.epc + ' age: '+antennaRssi.age);
      }
      return !isAncient; 
    });
    var isTagRecent = tag.antennaRssis.length > 0;
    if (!isTagRecent) {
      //util.log('Purging tag '+tag.epc);
      tagDidExit(tag)
    } 
    return isTagRecent;
  });
}

function tagDidEnter(tag : Shared.TagData) {
  //util.log('Tag ' + tag.epc + ' entered the floor');
  queryTagMetaData(tag);
}

function tagDidExit(tag : Shared.TagData) {
  //util.log('Tag ' + tag.epc + ' exited the floor');
}

function queryTagMetaData(tag : Shared.TagData) {
  dbConnectionPool.getConnection(function(err : any, con : any){
    if (err || !con) {
      util.error('Error during metadata lookup for tag ' + tag.epc + ': Problem with database connection:\n' + err);
    } else {
      con.query('SELECT * FROM visitors WHERE epc="'+tag.epc+'"',function(err : any, rows : Shared.TagMetaData[]) {
        if (err) {
          util.error('Error during metadata lookup for tag ' + tag.epc + ': SQL error:\n' + err);
        } else {
          if (rows == null) {
            util.error('Error during metadata lookup for tag ' + tag.epc + ': SQL response is null');
          } else if (rows.length == 0) { // tag not found
            //util.log('Queried ' + tag.epc + ': tag not found in database');
          } else if (rows.length == 1) { 
            try { // surround metaData assignment with try to catch incompatibilities in table format
              if (rows.length > 1) {
                util.error('Error during metadata lookup for tag ' + tag.epc + ': Mutiple rows in result.\n' +
                           'SQL result: ' + JSON.stringify(rows));
              }
              tag.metaData = { name: rows[0].name, color: rows[0].color };
              util.log('Queried metadata for tag ' + tag.epc + ': name is ' + tag.metaData.name +
                       (tag.metaData.color ? ' color: '+ tag.metaData.color : '') );
            } catch (e) {
              util.error('Error during metadata lookup for tag ' + tag.epc + ': Problem with database table format.\n' +
                         'SQL result: ' + JSON.stringify(rows) + '\nError: ' + e);
            }
          }
        }
      });
      con.release();
    }
  });
}

// return the index in allAntennas for the antenna with id ant 
function getAntennaNr(antennaId : Shared.AntennaId) {
  for (var i = 0; i < allAntennas.length; i++) {
    if (allAntennas[i].antennaId.readerIp == antennaId.readerIp && allAntennas[i].antennaId.antennaNr == antennaId.antennaNr)
      return i;
  }
  return -1;
}
