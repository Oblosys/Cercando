/// <reference path="./Config.ts" />
/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');
import fs       = require('fs');
import path     = require('path');

var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails

export function readConfigFile(filePath : string) : {config: Shared.ShortMidRangeSpec[]; err: Error} {
  try {
    var configJSON = <string>fs.readFileSync(filePath, {encoding:'utf8'});
    return validateConfig(JSON.parse(configJSON));
  } catch (err) {
    return {config: null, err: err};
  }
}

export function writeConfigFile(filePath : string, config : Shared.ShortMidRangeSpec[]) { 
  try {
    fs.writeFileSync(filePath, JSON.stringify(config));
  } catch (err) {
    util.error('Internal error: failed to write config to \'' + filePath + '\'');
    process.exit(1);
  }
}

export function validateConfig(configObject : any) : {config: Shared.ShortMidRangeSpec[]; err: Error} {
  var errMsg = '';
  var shortMidRangeSpecKeys = _.keys(shared.shortMidRangeSpecType);
  if (!_.isArray(configObject)) {
    errMsg += 'Object in config.json is not an array.';
  } else {
    for (var i=0; i<configObject.length; i++) {
      var elementErrs = '';
      var keys = _(configObject[i]).keys();
      _(shortMidRangeSpecKeys).each(key => {
        
        var val = configObject[i][key];
        if (configObject[i].hasOwnProperty(key)) {
          var expectedType = shared.shortMidRangeSpecType[key];
          if (typeof val != expectedType) {
            elementErrs += ' - key \'' + key +'\' has type ' + typeof val + ' instead of ' + expectedType + '\n';
          }
        } else {
          elementErrs += ' - key \'' + key + '\' is not specified\n'; 
        }
      });

      var extraKeys = _.difference(keys, shortMidRangeSpecKeys);
      if (!_.isEmpty(extraKeys))
        elementErrs += ' - unrecognized keys: ' + extraKeys + '\n';
      if (elementErrs) {
        errMsg += 'Error in element ' + i + ': ' + JSON.stringify(configObject[i]) + '\n' + elementErrs;
      }
    }
  }
  if (errMsg)
    return {config: <Shared.ShortMidRangeSpec[]>null, err: new Error(errMsg)};
  else
    return {config: <Shared.ShortMidRangeSpec[]>configObject, err: null};
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
