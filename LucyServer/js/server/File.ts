/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');
import fs       = require('fs');
import path     = require('path');

var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails

export function readConfigFile(lucyConfigFilePath : string) : {config: Shared.ShortMidRangeSpec[]; err: Error} {
  try {
    var configJSON = <string>fs.readFileSync(lucyConfigFilePath, {encoding:'utf8'});
    return validateConfig(JSON.parse(configJSON));
  } catch (err) {
    return {config: null, err: err};
  }
}

export function writeConfigFile(lucyConfigFilePath : string, config : Shared.ShortMidRangeSpec[]) { 
  try {
    fs.writeFileSync(lucyConfigFilePath, JSON.stringify(config));
  } catch (err) {
    util.error('Internal error: failed to write config to \'' + lucyConfigFilePath + '\'');
    process.exit(1);
  }
}

export function validateConfig(configObject : any) : {config: Shared.ShortMidRangeSpec[]; err: Error} {
  var errMsg = '';
  
  if (!_.isArray(configObject)) {
    errMsg += 'Object in config.json is not an array.';
  } else {
    for (var i=0; i<configObject.length; i++) {
      var keys = _(configObject[i]).keys();
      var missingKeys = _.difference(shared.shortMidRangeSpecKeys, keys);
      var extraKeys = _.difference(keys, shared.shortMidRangeSpecKeys);
      if (!_.isEmpty(missingKeys))
        errMsg += 'Element ' + i + ' is missing keys: ' + missingKeys + '\n'; 
      if (!_.isEmpty(extraKeys))
        errMsg += 'Element ' + i + ' has unrecognized keys: ' + extraKeys + '\n'; 
    }
  }
  if (errMsg)
    return {config: <Shared.ShortMidRangeSpec[]>null, err: new Error(errMsg)};
  else
    return {config: <Shared.ShortMidRangeSpec[]>configObject, err: null};
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
