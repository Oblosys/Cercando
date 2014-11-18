/*******************************************************************************/
/* File.ts                                                                     */
/*                                                                             */
/* Copyright (c) 2014, Martijn Schrage - Oblomov Systems. All Rights Reserved. */
/*                                                                             */
/*******************************************************************************/

/// <reference path="./Config.ts" />
/// <reference path="./ServerCommon.ts" />
/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');
import fs       = require('fs');
import path     = require('path');
import Config        = require('./Config');
import ServerCommon  = require('./ServerCommon');
var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails

// Libraries without TypeScript definitions:

var nodefs           = require('node-fs'); // for recursive dir creation


export function readConfigFile(filePath : string) : {config: Shared.DynamicConfig; err: string} {
  try {
    var configJSON = <string>fs.readFileSync(filePath, {encoding:'utf8'});
    return validateConfig(JSON.parse(configJSON));
  } catch (err) {
    return {config: null, err: err};
  }
}

export function writeConfigFile(filePath : string, config : Shared.DynamicConfig) { 
  try {
    fs.writeFileSync(filePath, JSON.stringify(config));
  } catch (err) {
    util.error('Internal error: failed to write config to \'' + filePath + '\'');
    process.exit(1);
  }
}

export function validateConfig(configObject : any) : {config: Shared.DynamicConfig; err: string} {
  var err = checkObjectKeys(shared.dynamicConfigType, configObject);
  if (!err)
    err = validateShortMidRangeSpecs(<Shared.DynamicConfig>configObject.shortMidRangeSpecs);
  
  if (err)
    return {config: <Shared.DynamicConfig>null, err: err};
  else
    return {config: <Shared.DynamicConfig>configObject, err: null};
}

export function validateShortMidRangeSpecs(configObject : any) : string {
  var errMsg = '';
  var shortMidRangeSpecKeys = _.keys(shared.shortMidRangeSpecType); // TODO: remove
  if (!_.isArray(configObject)) {
    errMsg += 'Object in config.json is not an array.';
  } else {
    for (var i=0; i<configObject.length; i++) {
      var elementErrs = checkObjectKeys(shared.shortMidRangeSpecType, configObject[i]);
  
      if (elementErrs) {
        errMsg += 'Error in shortMidRangeSpecs[' + i + ']: ' + JSON.stringify(configObject[i]) + '\n' + elementErrs;
      }
    }
  }
  return errMsg;
}

// check that keys of obj are exactly the same as keys of typeDesc, and that for each key k: typeof obj[k] == typeDesc[k]
function checkObjectKeys(typeDesc : any, obj : any) : string {
  var validationKeys = _.keys(typeDesc);
  var keys = _(obj).keys();
  var keyErrs = '';
  _(validationKeys).each(key => {
    
    var val = obj[key];
    if (obj.hasOwnProperty(key)) {
      var expectedType = typeDesc[key];
      if (typeof val != expectedType) {
        keyErrs += ' - key \'' + key +'\' has type ' + typeof val + ' instead of ' + expectedType + '\n';
      }
    } else {
      keyErrs += ' - key \'' + key + '\' is not specified\n'; 
    }
  });

  var extraKeys = _.difference(keys, validationKeys);
  if (!_.isEmpty(extraKeys))
    keyErrs += ' - unrecognized keys: ' + _(extraKeys).map(k => {return '\''+k+'\''}) + '\n';
  
  return keyErrs;
}

export function readUsersFile(filePath : string) : {users: Shared.UserRecord[]; err: Error} {
  try {
    var configJSON = <string>fs.readFileSync(filePath, {encoding:'utf8'});
    return {users: JSON.parse(configJSON), err: null};
  } catch (err) {
    return {users: null, err: err};
  }
}

export function writeUsersFile(filePath : string, users : Shared.UserRecord[]) { 
  try {
    fs.writeFileSync(filePath, JSON.stringify(users));
  } catch (err) {
    util.error('Internal error: failed to write config to \'' + filePath + '\'');
    process.exit(1);
  }
}


// Recursively get the directory trees starting at pth
// TODO: should be async, since we're running on the web server
export function getRecursiveDirContents(pth : string) : Shared.DirEntry[] {
  try {
    var names = _(fs.readdirSync(pth)).filter(name => {return _.head(name) != '.'}); // filter out names starting with '.'
    
    var entries = _(names).map(name => {
        var contents = [];
        if (fs.statSync(path.join(pth, name)).isDirectory()) {
          contents = getRecursiveDirContents(path.join(pth, name));
        } else {
          name = path.basename(name, '.csv'); // Drop .csv extension (other extensions should not exist, so we leave them to show the error)
        }
        return { name: name, contents:  contents };
      });
    
    return entries;
   } catch (e) {
     util.error('getRecursiveDirContents: Error reading directory ' + pth + '\n' + e);
     return [];
   }  
}

// Mimic the save format created by Motorola SessionOne app, but add the reader ip in an extra column (ip is not saved by SessionOne)
export var eventLogHeader = 'EPC, Time, Date, Antenna, RSSI, Channel index, Memory bank, PC, CRC, ReaderIp\n';

// createAutoSaveStream() does not actually create the output stream, this is done in updateAutoSaveStream()
export function createAutoSaveStream(minutesPerLog : number, basePath : string, filePrefix : string, header : string) : ServerCommon.AutoSaveStream {
  return { minutesPerLog: minutesPerLog
         , basePath: basePath
         , filePrefix: filePrefix
         , header: header
         , filePath: null
         , outputStream: null
         };
}

export function getTimeBasedFilePath(autoSaveStream : ServerCommon.AutoSaveStream) : string {
  var now = new Date();
  var filePath = autoSaveStream.basePath + '/' 
               + util.padZero(4, now.getFullYear()) + '-' + util.padZero(2, now.getMonth()+1) + '/'
               + util.padZero(2, now.getDate()) + '/'
               + autoSaveStream.filePrefix +
               + util.padZero(4, now.getFullYear()) + '-' + util.padZero(2, now.getMonth()+1) + '-' + util.padZero(2, now.getDate()) + '_'
               + util.padZero(2, now.getHours()) + '.'
               + util.padZero(2, Math.floor(Math.floor(now.getMinutes() / autoSaveStream.minutesPerLog) * autoSaveStream.minutesPerLog))
               + '.csv';
  return filePath;
}

// updateAutoSaveStream() guarantees that the autoSaveStream has an output file that corresponds to the current time slot
export function updateAutoSaveStream(autoSaveStream : ServerCommon.AutoSaveStream) {
  var desiredEventLogFilePath = getTimeBasedFilePath(autoSaveStream); 
  if (autoSaveStream.outputStream && autoSaveStream.filePath != desiredEventLogFilePath) {
    ServerCommon.log('Closing auto-save file:\n' + autoSaveStream.filePath);
    autoSaveStream.outputStream.end()
    autoSaveStream.outputStream = null;
    autoSaveStream.filePath = '';
  }
  if (!autoSaveStream.outputStream) {
    ServerCommon.log('Opening new auto-save file:\n' + desiredEventLogFilePath);
    
    if (!fs.existsSync( path.dirname(desiredEventLogFilePath)) ) { // if directory doesn't exist, recursively create all directories on path
      nodefs.mkdirSync( path.dirname(desiredEventLogFilePath), '0755', true); // 0755: rwxr-xr-x, true: recursive
    } 
    
    autoSaveStream.filePath = desiredEventLogFilePath;
    var logFileWasAlreadyCreated = fs.existsSync( desiredEventLogFilePath); // only happens if the server was interrupted during this log period
    autoSaveStream.outputStream = fs.createWriteStream(autoSaveStream.filePath, {flags: 'a'}); // 'a': append if file exists  
    
    if (!logFileWasAlreadyCreated) // don't add header if the file already existed
      autoSaveStream.outputStream.write(autoSaveStream.header);
  }
}

export var savedPositionsHeader = 'Date, Time, EPC, X, Y, Recent\n';

export function saveTagPositions(autoSaveStream : ServerCommon.AutoSaveStream, tagsState : Shared.TagsState) {
  if (tagsState.previousPositioningTimeMs) { // don't save until we have a correct previous positioning (this way we skip the initialization)
    updateAutoSaveStream(autoSaveStream);
    var timestamp = new Date(tagsState.previousPositioningTimeMs);
    var timeStr = util.showTime(timestamp)+'.'+timestamp.getMilliseconds();
    var tagLocations : {epc:string; x:number; y:number}[] = [];
    _(tagsState.tagsData).each(tag => {
        if (tag.coordinate) { // in case no location was computed yet
          var line = [util.showDate(timestamp), timeStr, tag.epc, tag.coordinate.coord.x.toFixed(4), tag.coordinate.coord.y.toFixed(4), tag.coordinate.isRecent ? 1 : 0].join(', ');
          autoSaveStream.outputStream.write(line+'\n');
        }
    });
  }
}

// File utils

// Only allow letters, digits, and slashes
export function isSafeFilePath(filePath : string) : boolean {
  return /^[a-zA-Z0-9" "\(\)\-\_]+$/.test(filePath);
}

export function mkUniqueFilePath(fullFilePath : string, success : (uniqueFilePath : string) => any) {
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
