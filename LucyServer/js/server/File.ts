/*******************************************************************************/
/* File.ts                                                                     */
/*                                                                             */
/* Copyright (c) 2014, Martijn Schrage - Oblomov Systems. All Rights Reserved. */
/*                                                                             */
/*******************************************************************************/

/// <reference path="./Config.ts" />
/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');
import fs       = require('fs');
import path     = require('path');

var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails

export function readConfigFile(filePath : string) : {config: Shared.LucyConfig; err: string} {
  try {
    var configJSON = <string>fs.readFileSync(filePath, {encoding:'utf8'});
    return validateConfig(JSON.parse(configJSON));
  } catch (err) {
    return {config: null, err: err};
  }
}

export function writeConfigFile(filePath : string, config : Shared.LucyConfig) { 
  try {
    fs.writeFileSync(filePath, JSON.stringify(config));
  } catch (err) {
    util.error('Internal error: failed to write config to \'' + filePath + '\'');
    process.exit(1);
  }
}

export function validateConfig(configObject : any) : {config: Shared.LucyConfig; err: string} {
  var err = checkObjectKeys(shared.lucyConfigType, configObject);
  if (!err)
    err = validateShortMidRangeSpecs(<Shared.LucyConfig>configObject.shortMidRangeSpecs);
  
  if (err)
    return {config: <Shared.LucyConfig>null, err: err};
  else
    return {config: <Shared.LucyConfig>configObject, err: null};
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
