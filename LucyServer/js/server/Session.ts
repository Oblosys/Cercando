/// <reference path="./Config.ts" />
/// <reference path="../shared/Shared.ts" />
/// <reference path="./ServerCommon.ts" />

import _        = require('underscore');
import fs       = require('fs');
import util     = require('oblo-util');

import Config        = require('./Config');
import File          = require('./File');  
var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails
import ServerCommon  = require('./ServerCommon');

var sessionExpirationTimeMs = 5 * 1000;
export var expressSessionOptions = {secret: 'lucy in the sky', cookie: {maxAge:sessionExpirationTimeMs}, rolling: true};
// rolling: keep resetting expiration on each response

var allSessions : Shared.SessionState[] = [];

export function getNrOfSessions() : number {
  return allSessions.length;
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

export function getSession(req : Express.Request) : Shared.SessionState {
  var sessionId = (<any>req).session.id;
  var session = _(allSessions).findWhere({sessionId: sessionId});
  // throw error if null
  return session;
}

export function getOrInitSession(req : Express.Request) : Shared.SessionState {
  var sessionId = (<any>req).session.id;
  var session = _(allSessions).findWhere({sessionId: sessionId});
  if (!session) {
    session = {sessionId: sessionId, lastAccess: null, user: null}
    allSessions.push(session);
  }
  return session;  
}

export function getSessionInfo(req : Express.Request) : Shared.SessionInfo {
  var session = getSession(req);
  var userInfo = mkUserInfo(session.user);
  return {userInfo: userInfo, nrOfSessions: getNrOfSessions()};
}

function mkUserInfo(user : Shared.SessionUser) : Shared.UserInfo {
  return user ? {username: user.username, firstName: user.firstName} : null;
}

export function login(req : Express.Request, username : string, password : string) : Shared.LoginResponse {
  // todo check for existing session?
  var user = getUser(username);
  if (user && password == user.passwordHash) { // TODO: poorest man's authentication
    var session = getSession(req);
    session.user = user;
    ServerCommon.log('Successful login for ' + username);
    return {userInfo: mkUserInfo(user), err: null};
  } else {
    ServerCommon.log('Failed login for ' + username);
    return {userInfo: null, err: 'Incorrect username or password'};
  }
}

export function logout(req : Express.Request) {
  getSession(req).user = null;  
}

export function pruneSessions() {
  var nowMs : number = new Date().getTime();
  _(allSessions).each(session => {
    //util.log(session.lastAccess + ', age: ' + (nowMs - session.lastAccess.getTime()));
  });
  var nrOfSessionsBeforePrune = allSessions.length;
  allSessions = _(allSessions).filter(session => {
    return (nowMs - session.lastAccess.getTime()) < sessionExpirationTimeMs + 1000;
  }); // add a second, to be sure we don't remove sessions before the html session id expires
  //util.log(new Date() + ' Pruned ' + (nrOfSessionsBeforePrune-allSessions.length) + ' sessions');
}
