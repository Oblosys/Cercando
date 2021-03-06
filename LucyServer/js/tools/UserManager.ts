/*******************************************************************************/
/* UserManager.ts                                                              */
/*                                                                             */
/* Copyright (c) 2014, Martijn Schrage - Oblomov Systems. All Rights Reserved. */
/*                                                                             */
/*******************************************************************************/

/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../server/File.ts" />
/// <reference path="../server/Config.ts" />
/// <reference path="../shared/Shared.ts" />

import fs       = require('fs');
import _        = require('underscore');
import util     = require('oblo-util');

import File     = require('../server/File');  
import Config   = require('../server/Config');
var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails

// Libraries without TypeScript definitions:
var prompt = require('prompt');
var bcrypt = require('bcryptjs');

prompt.colors = false;

main();

function main() {
  var cmd = process.argv[2]; // argv[0] == 'node', argv[1] == '../UserManager.js'
  if (!cmd) {
    util.error('Error: Missing command');
    showHelp();
  } else {
    switch(process.argv[2]) {
      case 'help':
        showHelp();
        break;
      case 'list':
        if (process.argv.length == 3) 
          listUsers();
        else
          showSyntaxError();
        break;
      case 'add':
        var username = process.argv[3];
        var firstName = process.argv[4];
        var lastName = process.argv[5];
        var eMail = process.argv[6];
        if (process.argv.length == 7 && username && firstName && lastName && eMail) 
          addUser(username, firstName, lastName, eMail);
        else
          showSyntaxError();
        break;
      case 'remove':
        var username = process.argv[3];
        if (process.argv.length == 4 && username) 
          removeUser(username);
        else
          showSyntaxError();
        break;
      default:
        util.error('Unknown command: \'' + cmd + '\'');
        showHelp();    
    }
  }
}
function showSyntaxError() {
  util.log('Syntax error');
  showHelp();
}

function showHelp() {
  util.log('Usage: user-manager help');
  util.log('       user-manager list');
  util.log('       user-manager add <username> <first_name> <last_name> <e-mail>');
  util.log('       user-manager remove <username>');
  util.log('');
  util.log('Example:');
  util.log('user-manager add martijn Martijn Schrage martijn@oblomov.com');
}

function listUsers() {
  var colWidthUsername = 10;
  var colWidthFullName = 24;
  util.log(pad(colWidthUsername, 'USERNAME') + pad(colWidthFullName, 'FIRST & LAST NAME') + 'E-MAIL');
  var users = readUsersFile();
  if (users.length != 0) {
    _(users).each(user => {
      util.log(pad(colWidthUsername, user.username) + pad(colWidthFullName, user.firstName + ' ' + user.lastName) + user.eMail);
    });
  } else {
    util.log('<no users>');
  }
}

function addUser(username : string, firstName : string, lastName : string, eMail : string) {
  var users = readUsersFile();
  if (!_(users).findWhere({username: username})) {
    addUserNoCheck(users, username, firstName, lastName, eMail);
  } else {
    promptString('User \'' + username + '\' already exists, update record? (answer \'yes\' or \'no\')', false, answer => {
      if (answer == 'yes') {
        var newUsers = removeUserNoCheck(users, username);
        addUserNoCheck(newUsers, username, firstName, lastName, eMail);
      } else {
        console.log('User add canceled');
      }
    });
  } 
}    

function addUserNoCheck(users : Shared.UserRecord[], username : string, firstName : string, lastName : string, eMail : string) {
  promptString('Please enter a password for user \'' + username + '\':', true, password => {
    promptString('Please re-enter password to confirm:', true, password2 => {
      if (password != password2) {
        util.error('Error: Passwords don\'t match')
      } else { 
        var passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync());
        var user : Shared.UserRecord =
          {username: username, firstName: firstName, lastName: lastName, eMail: eMail, passwordHash: passwordHash};
        users.push(user);
        File.writeUsersFile(Config.lucyUsersFilePath, users);
        util.log('User has been added successfully');
      }
    });
  });
}

function removeUser(username : string) {
  var users = readUsersFile();
  if (_(users).findWhere({username: username})) {
    promptString('Are you sure you wish to remove user \'' + username + '\'? (answer \'yes\' or \'no\')', false, answer => {
      if (answer == 'yes') {
        var newUsers = removeUserNoCheck(users, username);
        File.writeUsersFile(Config.lucyUsersFilePath, newUsers);
        util.log('User has been removed successfully');
      } else {
        console.log('User remove canceled');
      }
    });
  } else {
    util.error('Error: Unknown user: \'' + username + '\'');
  }  
}

// Note: does not write users file
function removeUserNoCheck(users : Shared.UserRecord[], username : string) : Shared.UserRecord[] {
  return _(users).filter(user => {return user.username != username});
}

// Utilities

function readUsersFile() : Shared.UserRecord[] {
  var result = File.readUsersFile(Config.lucyUsersFilePath);
  if (!result.users) {
    util.error('Error accessing users file: ' + Config.lucyUsersFilePath + '\n' + result.err);
  } else {
    return result.users;
  }
}


// prompt for a user response on stdin
function promptString(message : string, isPassword : boolean,  cont : (answer : string) => void) {
 prompt.start();
 prompt.message = '';
 prompt.delimiter = '';
 prompt.get([{name: 'answer', description: message, hidden: isPassword}], function (err : Error, result : {answer : string}) {
    if (err) {
      util.error(err);
      process.exit(1);
    }
    cont(result.answer);
  });
}

// pad string with trailing spaces 
function pad(l : number, str : string) {
  var nrOfSpaces = Math.max(0, l-(str).length);
  return str + util.replicate(nrOfSpaces,' ').join('');
};
