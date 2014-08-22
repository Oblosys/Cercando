/// <reference path="../shared/Shared.ts" />
var _ = require('underscore');
var util = require('oblo-util');
var fs = require('fs');
var path = require('path');

var shared = require('../shared/Shared.js');

// Recursively get the directory trees starting at pth
// TODO: should be async, since we're running on the web server
function getRecursiveDirContents(pth) {
    try  {
        var names = _(fs.readdirSync(pth)).filter(function (name) {
            return _.head(name) != '.';
        });

        var entries = _(names).map(function (name) {
            var contents = [];
            if (fs.statSync(path.join(pth, name)).isDirectory()) {
                contents = exports.getRecursiveDirContents(path.join(pth, name));
            } else {
                name = path.basename(name, '.csv'); // Drop .csv extension (other extensions should not exist, so we leave them to show the error)
            }
            return { name: name, contents: contents };
        });

        return entries;
    } catch (e) {
        util.error('getRecursiveDirContents: Error reading directory ' + pth + '\n' + e);
        return [];
    }
}
exports.getRecursiveDirContents = getRecursiveDirContents;

// Only allow letters, digits, and slashes
function isSafeFilePath(filePath) {
    return /^[a-zA-Z0-9" "\(\)\-\_]+$/.test(filePath);
}
exports.isSafeFilePath = isSafeFilePath;

function mkUniqueFilePath(fullFilePath, success) {
    var pathNameArr = fullFilePath.match(/(.*)\/([^\/]*$)/);
    if (!pathNameArr || pathNameArr.length != 3) {
    } else {
        var filePath = pathNameArr[1];
        var filenameExt = pathNameArr[2];
        var nameExtArr = filenameExt.match(/(.*)\.([^\.]*$)/);
        var filename;
        var ext;
        if (nameExtArr && nameExtArr.length == 3) {
            filename = nameExtArr[1];
            ext = '.' + nameExtArr[2];
        } else {
            filename = filenameExt;
            ext = '';
        }
        fs.readdir(pathNameArr[1], function (err, files) {
            if (err) {
                util.error('Error on readdir in mkUniqueFilename: ' + err);
            } else {
                util.log(files, filename, ext);
                if (!(_(files).contains(filename + ext)))
                    success(fullFilePath); // the suggested name does not already exist
                else {
                    var filenameIndexed;
                    var i = 1;
                    do {
                        filenameIndexed = filename + ' (' + i++ + ')' + ext;
                        util.log('filenameIndexed' + filenameIndexed);
                    } while(_(files).contains(filenameIndexed));
                    success(filePath + '/' + filenameIndexed);
                }
            }
        });
    }
}
exports.mkUniqueFilePath = mkUniqueFilePath;
