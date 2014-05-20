/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/express/express.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />

import net      = require('net');
import util     = require('oblo-util');

var defaultServerPortNr = 8199; // port for the Presentation web servers

initServer();

function initServer() {
    var portArg = parseInt(process.argv[2]);
    var serverPortNr = portArg || defaultServerPortNr;

    util.log('\n\n\nStarting Dummy presentation server on port ' + serverPortNr + '\n\n');

    var server = net.createServer(function(clientSocket : net.Socket) { //'connection' listener
      //util.log('client connected');
      
      clientSocket.on('data', function(buffer : NodeBuffer) {
        var tagInfo : string = buffer.toString('utf8');
        var vars : any = {};
        var params = tagInfo.split('&');
        for(var i = 0; i < params.length; i++){
            var paramArr = params[i].split('=');
            vars[paramArr[0]] = paramArr[1];
        }
        if (vars.epc && vars.antennaIndex)
          util.log(new Date() + ' Saw tag ' + vars.epc + ' on antenna ' + vars.antennaIndex);
      }); 
      clientSocket.on('end', function() {
        //console.log('Client disconnected');
        clientSocket = null;
      });
      
    //c.pipe(c);
  });
  server.listen(serverPortNr, function() {
    console.log('Listening to ' + serverPortNr);
    
  });

}
