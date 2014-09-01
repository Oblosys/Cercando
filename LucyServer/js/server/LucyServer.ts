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

// configuration constants

var defaultServerPortNr = 8080; // port for the Lucy web server
var remoteHostName = 'lucy.oblomov.com';
//var remoteHostName = '10.0.0.24';
var readerServerPortNr       = 8193;
var presentationServerPortNr = 8199;

var db_config = {
    host:'10.0.0.20', // replaced by 'localhost' when remoteReader paramater is given
    user: 'NHMR',
    password: '',
    database: 'lucy_test',
    connectTimeout: 5000
};

var reconnectInterval = 2000; // time in ms to wait before trying to reconnect to the reader server
var useSmoother = true;
var lucyDirectoryPath = process.env['HOME'] + '/lucy';
var lucyDataDirectoryPath = lucyDirectoryPath + '/data';
var lucyLogDirectoryPath = lucyDirectoryPath + '/log';
var lucyConfigFilePath = lucyDirectoryPath + '/config/config.json'; // local, so it can't easily be accidentally edited
var configUploadFilePath = lucyDataDirectoryPath + '/configUpload/config.json';
var saveDirectoryPath = lucyDataDirectoryPath + '/savedReaderEvents';
var userSaveDirectoryPath = saveDirectoryPath + '/userSave';
var autoSaveDirectoryPath = saveDirectoryPath + '/autoSave';
var cercandoGitDirectory = process.env['HOME'] + '/git/Cercando';

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
import file          = require('./File');  
import trilateration = require('./Trilateration');
import Config        = require('./Config');
import ServerCommon  = require('./ServerCommon');
var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails

// Libraries without TypeScript definitions:

var mysql            = require('mysql');
var lineByLineReader = require('line-by-line');
var nodefs           = require('node-fs'); // for recursive dir creation
var app = express();

// global state variables

var state : Shared.ServerState
var latestReaderEventTimeMs : number;   // time in milliseconds of the latest reader event (may be in the past for replays)
var previousPositioningTimeMs : number; // contains the value of latestReaderEventTimeMs at the previous moment of positioning 
var allAntennaLayouts : Shared.AntennaLayout[];
var allAntennas : Shared.Antenna[];

var readerServerSocket : net.Socket;
var eventLogFilePath : string; // Based on current time
var eventLogFileStream : fs.WriteStream;
var outputFileStream : fs.WriteStream; // for explicitly saving reader events
var replayFileStream : fs.ReadStream; // if this is non-null, a replay is taking place

var readerServerHostName : string;
var serverPortNr : number;

var dbConnectionPool : any;


initServer();

function initServer() {
  // usage: LucyServer [portNr] [--remoteReader]
  var portArg = parseInt(process.argv[2]);
  serverPortNr = portArg || defaultServerPortNr;
  
  if (process.argv[2] == '--remoteReader' || portArg && process.argv[3] == '--remoteReader') {
    // use remoteReader to connect to reader server on lucy.oblomov.com instead of localhost 
    readerServerHostName = remoteHostName;
    db_config.host = 'localhost';
//    db_config.host = '10.0.0.20'; // select this line when we run on the Lucy network (or VPN) and want to use the Synology MySQL server
  } else {
    readerServerHostName = "localhost";
  }
  dbConnectionPool = mysql.createPool(db_config);
  
  util.log('\n\n');
  logTs('Starting Lucy server on port ' + serverPortNr + ', using reader server on ' + readerServerHostName + '\n\n');
  
  allAntennaLayouts = Config.getAllAntennaLayouts();
  resetServerState();
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

  // serve 'client', 'shared', and 'node-modules' directories, but not 'server'
  app.use('/js/client', express.static(__dirname + '/../client'));
  app.use('/js/shared', express.static(__dirname + '/../shared'));
  app.use('/js/node_modules', express.static(__dirname + '/../node_modules'));
  app.use('/data', express.directory(lucyDataDirectoryPath));
  app.use('/data', express.static(lucyDataDirectoryPath));
  app.use('/logs', express.directory(lucyLogDirectoryPath));
  app.use('/logs', express.static(lucyLogDirectoryPath));
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
    child_pr.exec( cercandoGitDirectory + '/scripts/generateGitInfo.sh'
                 , {cwd: '../..'}
                 , function(error, stdout, stderr) { 
                     res.setHeader('content-type', 'application/json');
                     res.send(stdout); 
                   } );
  });
  
  app.get('/query/view-config', function(req, res) {  
    res.setHeader('content-type', 'text/html');    
    var html = 'Current short/mid-range configuration:<br/><br/>';

    html += '<tt>' + JSON.stringify(Config.getShortMidRangeSpecs(lucyConfigFilePath)) + '</t>';
    html += '<br/><br/><input type="button" onclick="history.go(-1);" value="&nbsp;&nbsp;Ok&nbsp;&nbsp;"></input>';
    res.send(html);
    });

  app.get('/query/upload-config', function(req, res) {  
    res.setHeader('content-type', 'text/html');
    var html = '';
    var result = file.readConfigFile(configUploadFilePath);
    if (result.err) {
      html += '<span style="color: red">ERROR: Uploading new configuration from Synology NAS (/web/lucyData/configUpload/config.json) failed:</span><br/>';
      html += '<pre>' + result.err + '</pre>';
    } else {
      try {
        fs.unlinkSync(configUploadFilePath); // remove upload file, so we won't confuse it with the current config
      } catch(err) {
        html += '<span style="color: red">ERROR: Failed to remove upload file: /web/lucyData/configUpload/config.json</span>';
        html += '<pre>' + err + '</pre>';
        html += 'Please remove the file manually.<br/><br/>';
      } // failed removal is not fatal, so we continue
      
      file.writeConfigFile(lucyConfigFilePath, result.config); // write the new config to the local config file
      initAntennaLayout(state.selectedAntennaLayoutNr); // incorporate new short/mid-range specs in antennaLayout
      html += 'Succesfully uploaded short/mid-range configuration from Synology NAS to Lucy server:<br/><br/>';
      html += '<tt>' + JSON.stringify(result.config) + '</tt>';
    } 
    html += '<br/><br/><input type="button" onclick="history.go(-1);" value="&nbsp;&nbsp;Ok&nbsp;&nbsp;"></input>';
    res.send(html);
  });

  app.get('/query/tags', function(req, res) {  
    //util.log('Sending tag data to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    
    state.status.readerServerTime = latestReaderEventTimeMs ? ''+new Date(latestReaderEventTimeMs) : null;
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
    initAntennaLayout(req.params.nr);
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

  app.get('/query/replay-info', function(req, res) {  
    util.log('Sending replay info to client. (' + new Date() + ')');
    res.setHeader('content-type', 'application/json');
    logTs('Getting replay directory structure')
    var replayInfo : Shared.ReplayInfo =
      { contents: file.getRecursiveDirContents(saveDirectoryPath) }; 
      //{ contents: [ { name: '7', contents: [ { name: '1', contents: [{name: '10.45', contents: []}, {name: '11.00', contents: []}] }, { name: '2', contents: [{name: '11.45', contents: []}, {name: '12.00', contents: []}] } ] }
      //            , { name: '8', contents: [ { name: '3', contents: [{name: '13.45', contents: []}, {name: '14.00', contents: []}] }, { name: '4', contents: [{name: '14.45', contents: []}, {name: '15.00', contents: []}] } ] }
      //            ] }
    res.send(JSON.stringify(replayInfo));
  });

  app.get('/query/start-replay', function(req, res) {
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
    startReplay(decodeURI(req.query.filename), cont);
  });

  app.get('/query/stop-replay', function(req, res) {
    util.log('Stop-replay request');
    stopReplay();
    res.setHeader('content-type', 'text/plain');
    res.writeHead(204);
    res.end();
  });

  // For communicating with Di Colore software
  app.get('/query/tag-locations', function(req, res) {
    positionAllTags(); // TODO: keep track of positioned tags, to prevent recomputation
    var locations : {epc:string; x:number; y:number}[] = [];
    _(state.tagsData).each(tag => {
        if (tag.coordinate) { // in case no location was computed yet (TODO: may be unnecessary when we keep track of positioned tags)
          locations.push({epc: tag.epc, x:+tag.coordinate.coord.x.toFixed(2), y:+tag.coordinate.coord.y.toFixed(2)}) 
        }
    });
    var now = new Date();
    var tagLocations : Shared.TagLocations = { timestamp: util.showDate(now) + ' ' + util.showTime(now), tagLocations: locations}
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify(tagLocations));
  });

  // For communicating with Di Colore software
  app.get('/query/short-mid-tag-distances', function(req, res) {
    positionAllTags(); // TODO: keep track of positioned tags, to prevent recomputation
    // TODO: maybe enforce distance in AntennaRssi, then we don't even need to do positioning at all for this function
    // sparse array for keeping track of tags per antenna (we keep 
    var allAntennaTags : { epc:string; rssi:number; distance:number}[][] = util.replicate(allAntennas.length, []);
        
    _(state.tagsData).each(tag => {
      _(tag.antennaRssis).each(antRssi => {
        //util.log(tag.epc + ' ' + JSON.stringify(antRssi));
        if (allAntennas[antRssi.antNr].shortMidRange!=null && antRssi.age < 0.5) // TODO: use better way to clear short/mid faster than normal antennas, or use constant
          // TODO: age seems incorrect: always 0 except for the last entry  
          allAntennaTags[antRssi.antNr].push({epc: tag.epc, rssi: antRssi.value, distance: antRssi.distance});
      }); 
    });

    var allAntennaData: { antennaName:string; tagDistances : { epc:string; rssi:number; distance:number}[] }[] =
      _(allAntennaTags).map((tagsInRange, antennaNr) => {
        return {antennaName: allAntennas[antennaNr].name, tagDistances: tagsInRange};
      });

    // filter short/midrange antennas from sparse array
    var shortMidRangAntennaData = _(allAntennaData).filter((antenna, antennaNr) => {return allAntennas[antennaNr].shortMidRange != null});
    
    var tagDistances : Shared.TagDistances = {antennaData: shortMidRangAntennaData};
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify(tagDistances));
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
  var shortMidRangeSpecs = Config.getShortMidRangeSpecs(lucyConfigFilePath);
  allAntennas = ServerCommon.mkReaderAntennas(allAntennaLayouts[state.selectedAntennaLayoutNr], shortMidRangeSpecs);
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
    logTs('Connection to reader server failed (error code: ' + err.code + '), retrying..');
    if (readerServerSocket) 
      readerServerSocket.destroy();
  });
  readerServerSocket.on('close', function() {
    logTs('Connection closed');
    destroySocketAndRetryConnection();
  });

  logTs('Trying to connect to reader server on '+readerServerHostName+':'+readerServerPortNr);
  readerServerSocket.connect(readerServerPortNr, readerServerHostName);
}

function destroySocketAndRetryConnection() {
  state.status.isConnected = false;
  if (readerServerSocket) 
    readerServerSocket.destroy(); // destroy socket if it wasn't already destroyed, just to make sure
  readerServerSocket = null;
  
  logTs('Connection to reader server lost, reconnecting..');
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
  logTs('Connected to reader server at: ' + readerServerHostName + ':' + readerServerPortNr);
  
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
  if (!file.isSafeFilePath(filePath))
    cont.error('Invalid file path: "'+filePath+'"\nMay only contain letters, digits, spaces, and these characters: \'(\' \')\' \'-\' \'_\'');
  else {
    var fullFilename = userSaveDirectoryPath + '/' + filePath+'.csv';
    file.mkUniqueFilePath(fullFilename, (uniqueFilePath) => {
      outputFileStream = fs.createWriteStream(uniqueFilePath);
      outputFileStream.on('error', function(err : Error) {
        util.log('Start-saving failed: ' + err.message);
        cont.error(err.message);
      });
      outputFileStream.once('open', function(fd :  number) {
        state.status.isSaving = true;
        // Mimic the save format created by Motorola SessionOne app, but add the reader ip in an extra column (ip is not saved by SessionOne) 
        outputStreamWriteHeader(outputFileStream);
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

function outputStreamWriteHeader(outputStream : fs.WriteStream) {
  outputStream.write('EPC, Time, Date, Antenna, RSSI, Channel index, Memory bank, PC, CRC, ReaderIp\n')
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

function getEventLogFilePath() : string {
  var logLength = 60 / 4; // logLength should be a divisor of 60
  var now = new Date();
  var filePath = autoSaveDirectoryPath + '/' 
               + util.padZero(4, now.getFullYear()) + '-' + util.padZero(2, now.getMonth()+1) + '/'
               + util.padZero(2, now.getDate()) + '/'
               + 'readerEvents_' +
               + util.padZero(4, now.getFullYear()) + '-' + util.padZero(2, now.getMonth()+1) + '-' + util.padZero(2, now.getDate()) + '_'
               + util.padZero(2, now.getHours()) + '.' + util.padZero(2, Math.floor(Math.floor(now.getMinutes() / logLength) * logLength) )
               + '.csv';
  return filePath;
}

function logReaderEvent(readerEvent : ServerCommon.ReaderEvent) {
  var desiredEventLogFilePath = getEventLogFilePath(); // TODO: using current time may cause filename to be more recent than timestamp in event
  if (eventLogFileStream && eventLogFilePath != desiredEventLogFilePath) {
    logTs('Closing file auto-save file:\n' + eventLogFilePath);
    eventLogFileStream.end()
    eventLogFileStream = null;
    eventLogFilePath = '';
  }
  if (!eventLogFileStream) {
    logTs('Opening file new auto-save file:\n' + desiredEventLogFilePath);
    
    if (!fs.existsSync( path.dirname(desiredEventLogFilePath)) ) { // if directory doesn't exist, recursively create all directories on path
      nodefs.mkdirSync( path.dirname(desiredEventLogFilePath), '0755', true); // 0755: rwxr-xr-x, true: recursive
    } 
    
    eventLogFilePath = desiredEventLogFilePath;
    var logFileWasAlreadyCreated = fs.existsSync( desiredEventLogFilePath); // only happens if the server was interrupted during this log period
    eventLogFileStream = fs.createWriteStream(eventLogFilePath, {flags: 'a'}); // 'a': append if file exists  
    
    if (!logFileWasAlreadyCreated) // don't add header if the file already existed
      outputStreamWriteHeader(eventLogFileStream);
  }
  outputStreamWriteReaderEvent(eventLogFileStream, readerEvent);
}

var replayFileReader : any;
var replayStartClockTime : number; // TODO explain + mention ms
var replayStartEventTime : number;

// TODO line-by-line is also buggy: async processing according to https://www.npmjs.org/package/line-by-line stops at the start of the last
// chunk, meaning we lose the last 5 seconds of each replay and cannot replay files under 5 seconds (determined by nr of lines, so actual time may vary) 
// TODO Quickly tapping the start-replay button hangs Firefox. Chrome is fine though. 
// Note: filePath is relative to saveDirectoryPath and without .csv extension
function startReplay(filePath : string, cont : {success : () => void; error : (message : string) => void}) {
  util.log('Start-replay request for filename ' + filePath);
  if (!file.isSafeFilePath(filePath.replace(/[\/,\.]/g,''))) { // first remove / and ., which are allowed in replay file paths
    // This is safe as long as we only open the file within the server and try to parse it as csv, when csv can be downloaded we need stricter
    // safety precautions.
    cont.error('Invalid file path: "'+filePath+'"\nMay only contain letters, digits, spaces, and these characters: \'(\' \')\' \'-\' \'_\'  \'/\'  \'.\'');
  } else {
    var replayFilePath = saveDirectoryPath + '/' + filePath + '.csv';

    if (!fs.existsSync( replayFilePath )) { 
      // Check file existence beforehand, since we cannot use cont.error() after the lineReader has been created (creation 
      // succeeds even for missing file and only calls the error callback afterwards).
      var err = 'Error: Replay file does not exist: '+ replayFilePath;
      util.log(err);
      cont.error(err);
    } else {
      // Because line-by-line does not distinguish automatic close (after error or eof) from user-initiated close, and the 'end' event
      // is emited after a delay, we need to disable 'end' handling, since otherwise the new file reader will be cleared at this event.
      if (replayFileReader) {
        replayFileReader.removeAllListeners('end');    
        replayFileReader.close();
        clearReplay();
      }
      
      state.tagsData = [];
      state.status.replayFileName = filePath;

      // TODO: drop header line more elegantly
      var lineReader = new lineByLineReader(replayFilePath);
      
      replayFileReader = lineReader;
      
      lineReader.on('error', (err : Error) => {
        //clearReplay();
        util.error('lineReader: error while reading \'' + filePath + '\'');
        util.error(err);
      });
      
      lineReader.on('line', (line : string) => {
        //util.log('line');
        lineReader.pause(); // replayFileReader is resumed by readReplayEvent()
        readReplayEvent(line, lineReader);
      });
        
      lineReader.on('end', () => {
        util.log('Ending replay'); // TODO: apparently called several times
        clearReplay();
      });
      cont.success();
    }
  }
}

function stopReplay() {
  if (replayFileReader)
    replayFileReader.close();
}

function clearReplay() {
  replayFileReader = null;
  state.tagsData = [];
  state.status.replayFileName = null;
  replayStartClockTime = null;
  replayStartEventTime = null;
}

function readReplayEvent(line : string, lineReader : any) {
  //util.log('Read replay line: ' + line);
  var replayEvent = parseReplayEventCSV(line);
  if (!replayEvent) {
    lineReader.resume();
  } else {
    var replayEventTime = new Date(replayEvent.timestamp).getTime();
    if (!replayStartClockTime) { // This means we're reading the first event
      replayStartClockTime = new Date().getTime();
      replayStartEventTime = replayEventTime;
      //util.log('Replay first event timestamp: ' + new Date(replayEventTime));
      state.tagsData = [];
    }
    
    var replayEventRelativeTime = new Date(replayEvent.timestamp).getTime() - replayStartEventTime;
    var replayEventClockTime = replayStartClockTime + replayEventRelativeTime;
    var eventDelay = util.clip(0, Number.MAX_VALUE, replayEventClockTime - new Date().getTime());
    //util.log(replayEventRelativeTime + '  ' + eventDelay);

    //util.log('Emit event: ' + JSON.stringify(replayEvent));
    processReaderEvent(replayEvent);
    
    setTimeout(() => {
      lineReader.resume();
    }, eventDelay);
  }      
}

// NOTE: we assume the fields do not contain commas, so every comma is a separator
function parseReplayEventCSV(csvLine : string) : ServerCommon.ReaderEvent {
  var values = _(csvLine.split(',')).map(rawField => {return rawField.replace(/^ /,'')});
  
  if (values.length != 10) {
    util.error('Error: csv line has incorrect nr. of fields:\n' + csvLine);
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
  //util.log('Reader event: ' + JSON.stringify(readerEvent));
  logReaderEvent(readerEvent);
  if (!replayFileReader) {
    processReaderEvent(readerEvent);
  }
}

// Process ReaderEvent, possibly coming from a replay
function processReaderEvent(readerEvent : ServerCommon.ReaderEvent) {
  var timestamp = new Date(readerEvent.timestamp);
  latestReaderEventTimeMs = timestamp.getTime();
  //util.log('Reader event: ' + JSON.stringify(readerEvent));
  if (outputFileStream) {
    outputStreamWriteReaderEvent(outputFileStream, readerEvent);
  }

  var tag = _.findWhere(state.tagsData, {epc: readerEvent.epc});
  if (!tag) {
    tag = { epc:readerEvent.epc, antennaRssis: [], metaData: null }
    state.tagsData.push(tag);
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
    
    var newRssi = !useSmoother ? readerEvent.rssi 
                               : filtered(readerEvent.epc, readerEvent.ant, readerEvent.rssi, timestamp, oldAntennaRssi);

    var distance = trilateration.getDistanceForRssi(tag.epc, allAntennas[antNr].name, newRssi);
    var newAntennaRssi : Shared.AntennaRSSI = {antNr: antNr, value: newRssi, timestamp: timestamp, distance: distance};
    //if (readerEvent.epc == '0000000000000000000000000503968' && readerEvent.ant == 1) {
    //  util.log(new Date().getSeconds() + ' ' + readerEvent.epc + ' ant '+readerEvent.ant + ' rawRssi: '+readerEvent.rssi.toFixed(1) + ' dist: '+
    //          trilateration.getDistanceForRssi(readerEvent.epc, ''+readerEvent.ant, readerEvent.rssi));
    //}
    
    updateAntennaRssi(newAntennaRssi, tag.antennaRssis);
    //trilateration.getDistanceForRssi(readerEvent.ePC, readerEvent.ant, readerEvent.RSSI);
    //util.log(tagsState);
    if (allAntennas[antNr].shortMidRange) {
      var shortMidRange = allAntennas[antNr].shortMidRange;
      //TODO: obsolete
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
  //           trilateration.getDistanceForRssi(epc, ''+ant, newRssi).toFixed(1) + ' newRssi: '+newRssi.toFixed(1));
  //}
  
  //util.log(util.padZero(3,dT) + JSON.stringify(previousRssi) );
  //util.log(util.padZero(3,dT) + JSON.stringify(previousRssi.value) );
  return newRssi;
}




// trilaterate all tags and set age and distance for each rssi value
function positionAllTags() {
  var dt = previousPositioningTimeMs ? (latestReaderEventTimeMs - previousPositioningTimeMs) / 1000 :  0
  previousPositioningTimeMs = latestReaderEventTimeMs; 

  //util.log(state.tagsData.length + ' tags')
  // set the age for each antennaRssi for each tag
  _(state.tagsData).each((tag) => {
    //util.log(tag.epc + ':' + tag.antennaRssis.length + ' signals');
    _(tag.antennaRssis).each((antennaRssi) => {
      antennaRssi.age = latestReaderEventTimeMs - antennaRssi.timestamp.getTime(); 
    });
  });
  
  purgeOldTags();  
  
  // compute coordinate for each tag
  _(state.tagsData).each((tag) => {
    var shortMidRangeRssi = _(tag.antennaRssis).find((antennaRssi) => {
      var shortMidRange = allAntennas[antennaRssi.antNr].shortMidRange;
      return shortMidRange != null && shared.isRecentAntennaRSSI(antennaRssi);
    });
    if (shortMidRangeRssi && shortMidRangeRssi.value > shared.shortMidRagneRssiThreshold) {
      //util.log('short mid for tag '+tag.epc);
      tag.coordinate = {coord: allAntennas[shortMidRangeRssi.antNr].coord, isRecent:true};
    } else { // TODO: don't use short/mid-range antennas for trilateration
      var oldCoord = tag.coordinate ? tag.coordinate.coord : null;
      tag.coordinate = trilateration.getPosition(tag.epc, allAntennas, oldCoord, dt, tag.antennaRssis);
    }
  });
}

// remove all tags that only have timestamps larger than ancientAge
function purgeOldTags() {
  state.tagsData = _(state.tagsData).filter((tag) => {
    tag.antennaRssis = _(tag.antennaRssis).filter(antennaRssi => {
      var isAncient = antennaRssi.age > shared.ancientAgeMs;
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


function logTs(msg : string) {
  var date = new Date();
  util.log( util.padZero(4, date.getFullYear()) + '-' + util.padZero(2, date.getMonth()+1) + '-' + util.padZero(2, date.getDate())
          + ' ' + util.showTime(date) + ': ' + msg);
}
