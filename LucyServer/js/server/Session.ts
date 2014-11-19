/*******************************************************************************/
/* Session.ts                                                                  */
/*                                                                             */
/* Copyright (c) 2014, Martijn Schrage - Oblomov Systems. All Rights Reserved. */
/*                                                                             */
/*******************************************************************************/

/// <reference path="../typings/express/express.d.ts" />
/// <reference path="./Config.ts" />
/// <reference path="../shared/Shared.ts" />
/// <reference path="./ServerCommon.ts" />

import _        = require('underscore');
import express  = require('express');
import fs       = require('fs');
import util     = require('oblo-util');

import Config       = require('./Config');
import File         = require('./File');  
var shared          = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails
import ServerCommon = require('./ServerCommon');

// Libraries without TypeScript definitions:
var bcrypt = require('bcryptjs');


// Note: Passwords are sent over http without encryption. This is acceptable because we don't require a high level of security.
// Unauthorized access may lead to some replays to be started (possibly crashing the server and causing an immediate restart), or
// to a user-save file to be generated, but no real harm can be done. 

var sessionExpirationTimeMs = 5*1000; // 10 * 60 * 1000; // session expires after leaving the page for 10 minutes
export var expressSessionOptions = {secret: 'lucy in the sky', cookie: {maxAge:sessionExpirationTimeMs}, rolling: true};
// rolling: keep resetting expiration on each response

var allSessions : Shared.SessionState[] = [];

export function getNrOfSessions() : number {
  return allSessions.length;
}

export function eachSession(f : (session : Shared.SessionState) => void) {
  _(allSessions).each(f);
}
  
function getUser(username : string) : Shared.UserRecord {
  var result = File.readUsersFile(Config.lucyUsersFilePath);
  if (result.err) {
    util.error('Internal error: failed to read config from \'' + Config.lucyUsersFilePath + '\':\n'+result.err);
    return null;
  } else {
    return _(result.users).findWhere({username: username});
  }  
}

function getSession(req : express.Request) : Shared.SessionState {
  var sessionId = (<any>req).session.id;
  var session = _(allSessions).findWhere({sessionId: sessionId});
  // throw error if null
  return session;
}


// TODO: rename this one to getSession and use different name for current getSession
export function getOrInitSession(req : express.Request) : Shared.SessionState {
  var sessionId = (<any>req).session.id;
  var session = _(allSessions).findWhere({sessionId: sessionId});
  if (!session) {
    session = { sessionId: sessionId, lastAccess: null, user: null 
              , tagsState: {mostRecentEventTimeMs: null, previousPositioningTimeMs: null, tagsData: []}
              , replaySession: {fileReader: null, startClockTime: null, startEventTime: null}
    }
    allSessions.push(session);
  }
  return session;  
}

function expireSession(session : Shared.SessionState) : void {
  util.log('Expiring session: '+session.sessionId + (session.user ? ' from user ' + session.user.username : ' without login')); 
}

export function getSessionInfo(req : express.Request) : Shared.SessionInfo {
  var session = getSession(req);
  var userInfo = mkUserInfo(session.user);
  return {userInfo: userInfo, nrOfSessions: getNrOfSessions()};
}

function mkUserInfo(user : Shared.SessionUser) : Shared.UserInfo {
  return user ? {username: user.username, firstName: user.firstName} : null;
}

export function login(req : express.Request, username : string, password : string, cont : (loginResponse : Shared.LoginResponse) => void) {
  // todo check for existing session?
  ServerCommon.log('Login request for \'' + username + '\' from ip ' + req.ip);
  
  // use same error for incorrect username as for incorrect password, so attackers cannot determine whether username exists
  function loginFailed() {
    ServerCommon.log('Login failed: incorrect username or password');
    cont({userInfo: null, err: 'Incorrect username or password'});
  }
  
  var user = getUser(username);
  if (user) {
    bcrypt.compare(password, user.passwordHash, function(err : Error, res : boolean) {
      if (res) {
        var session = getSession(req);
        session.user = user;
        ServerCommon.log('Login successful');
        cont({userInfo: mkUserInfo(user), err: null});
      } else {
        loginFailed();
      }
    });
  } else {
    loginFailed();
  }
}

export function logout(req : express.Request) {
  var session = getSession(req);
  if (session.user) {
    ServerCommon.log('User \'' + session.user.username + '\' from ip ' + req.ip + ' logged out.');
    session.user = null;
  } else {
      ServerCommon.log('Invalid logout request from ip ' + req.ip + ': no user logged in');
  }  
}

export function pruneSessions() {
  var nowMs : number = new Date().getTime();
  _(allSessions).each(session => {
    //util.log(session.lastAccess + ', age: ' + (nowMs - session.lastAccess.getTime()));
  });
  var nrOfSessionsBeforePrune = allSessions.length;
  var activeSessions : Shared.SessionState[] = [];
  
  _(allSessions).each(session => {
    if (nowMs - session.lastAccess.getTime() < sessionExpirationTimeMs + 1000) // add a second, to be sure we don't remove sessions before the html session id expires
      activeSessions.push(session);
    else
      expireSession(session);
  });
  
  allSessions = activeSessions;
  //var nrOfLoginSessions = _(activeSessions).filter(session => {return session.user != null;}).length;
  //var nrOfReplayingSessions = _(activeSessions).filter(session => {return session.replaySession.fileReader != null;}).length;
  //util.log('Active sessions: '+activeSessions.length+' login sessions: '+nrOfLoginSessions+' replaying sessions: '+nrOfReplayingSessions);
  //util.log(new Date() + ' Pruned ' + (nrOfSessionsBeforePrune-allSessions.length) + ' sessions');
}

export function requireAuthorization() {
  return function(req : express.Request, res : express.Response, next:()=>void) {
    var session = getSession(req);
    if (session && session.user) {
      next();
    } else {
      ServerCommon.log('WARNING: Unauthorized request from ' + req.ip + ': ' + req.path);
      res.send(403);
    }
  }
};