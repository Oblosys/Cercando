/// <reference path="../typings/d3/d3.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/socket.io/socket.io-client.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />

/* 
TODO
Fix stuttering server updates
*/

var refreshInterval : number; // setInterval() returns a number
var serverState : Shared.ServerState;

function initRefreshSocket(floorSVG : D3.Selection) {
  //util.log(location.host);
  var socket = io.connect('http://'+location.host);
  socket.on('llrp', function (data) {   
    //util.log('LLRP event'+data.RSSI);
  });
}  
  
var debug = true;
var floorHeight = 500;
var floorWidth = 700;

var origin = {x: floorWidth/2, y: floorHeight/2}; // pixel coordinates for (0,0)
var pixelsPerMeter = 80;


/***** Initialization *****/

$(document).ready(function(){
  initialize();
});

// Duplicated, until we find an elegant way to share both types and code between client and server TypeScript
function initialServerState() : Shared.ServerState {
  return {
    visibleTags: [],
    status: {isConnected: false, isSaving: false},
    tagsData: []
  };
}

function initialize() {
  serverState = initialServerState();
  queryAntennas();
  var floorSVG = d3.select('#floor')
    .append('svg:svg')
    .attr('width', floorWidth)
    .attr('height', floorHeight);

  $('#floor').css('height',floorHeight+'px'); // for some reason height is rendered a bit too large, so we constrain it.

  floorSVG.append('g').attr('id', 'background-plane')
    .append('rect').attr('id', 'floor-background')
    .attr('width', floorWidth)
    .attr('height', floorHeight);
  floorSVG.append('g').attr('id', 'antenna-plane');
  floorSVG.append('g').attr('id', 'annotation-plane');
  floorSVG.append('g').attr('id', 'rssi-plane');
  floorSVG.append('g').attr('id', 'triangulation-plane');
  floorSVG.append('g').attr('id', 'visitor-plane');

  drawAntennas();
  //drawTagSetup();
  _.map(_.range(0, 10), (i : number) => drawMarker(i));

  connectReader();
}

function queryAntennas() {
  $.getJSON( 'query/antennas', function( data ) {
    allAntennas = data;
    drawAntennas();
  }) .fail(function(jqXHR : any, status : any, err : any) {
    console.error( "Error:\n\n" + jqXHR.responseText );
  });
}

function drawAntennas() {
  var antennaPlaneSVG = d3.select('#antenna-plane');

  _.each(allAntennas, (ant, i) => drawAntenna(antennaPlaneSVG, ant, i+1));

}

function drawAntenna(floorSVG : D3.Selection, antenna : Shared.Antenna, antennaNr : number) {
  var pos = toScreen(antenna.coord);
  floorSVG.append('circle').attr('class', 'a-'+antennaNr)
    .style('stroke', 'white')
    .style('fill', 'blue')
    .attr('r', 8)
    .attr('cx', pos.x)
    .attr('cy', pos.y);
  floorSVG.append('text').text(''+antenna.name)
    .attr('x', pos.x-3)
    .attr('y', pos.y+3.5)
    .attr('font-family', 'verdana')
    .attr('font-size', '10px')
    .attr('fill', 'white');
  
}
/*
function drawTagSetup() {
  var pxPerCm = 400/300;
  _(tagCoords).each((coord, tagNr)=>{
    drawSquare(coord.x*pxPerCm+350,coord.y*pxPerCm+250,10, tagColors[tagNr]);
  });
}
*/
function drawSquare(x : number, y : number, size : number, color : string) {
  var annotationPlaneSVG = d3.select('#annotation-plane');
 
  annotationPlaneSVG.append('rect')
    .style('stroke', 'white')
    .style('fill', color)
    .attr('x', x-size/2)
    .attr('y', y-size/2)
    .attr('width', size)
    .attr('height', size);
}

function drawMarker(markerNr : number) {
  var triangulationPlaneSVG = d3.select('#triangulation-plane');
 
  triangulationPlaneSVG.append('circle').attr('class', 'm-'+markerNr)
    .style('stroke', 'white')
    .style('fill', 'yellow')
    .attr('r', 6)
    .attr('cx', 20+markerNr * 10)
    .attr('cy', 20);
}

function updateTags() {
  var rssiPlaneSVG = d3.select('#rssi-plane');
  
  _.map(serverState.tagsData, (tagData) => {
    //util.log(tagRssis.epc + '(' + tagNr + ':' + tagColors[tagNr] + ')' + tagRssis.rssis);
    var tagNr = getTagNr(tagData.epc);
    //$('.tag-rssis:eq('+tagNr+') .tag-label').text(tagData.epc);
    var $tagLabel = $('.tag-rssis:eq('+tagNr+') .tag-label');
    $tagLabel.css('color',tagData.color);
    $tagLabel.text(tagNr + ' ' +tagData.epc.slice(-7));
    for (var ant=0; ant<allAntennas.length; ant++) {
      util.log('epc:'+tagData.epc+'  '+tagNr);
      var rssi = tagData.rssis[ant];

      var dist =  tagData.distances[ant];
      // show in table
      if (rssi) {
        $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+ant+')').html('<span class="dist-label">' + dist.toFixed(1) + '</span>' +
                                                                 '<span class="rssi-label">(' + rssi + ')</span>');
      }
      //util.log(tagNr + '-' + ant +' '+ rssi);

      var rangeClass = 'r-'+(ant+1)+'-'+tagNr; 
      var range = d3.select('.'+rangeClass)
      if (range.empty() && tagNr <=11) { // use <= to filter tags
        util.log('Creating range for ant '+(ant+1) + ': '+rangeClass);
        
        var pos = toScreen(allAntennas[ant].coord);
        range = rssiPlaneSVG.append('circle').attr('class', rangeClass)
                  .style('stroke', tagData.color)
                  .style('fill', 'transparent')
                  .attr('cx', pos.x)
                  .attr('cy', pos.y);
      }
      //util.log('A'+ant+': tag'+tagNr+': '+dist);
      range.attr('r', dist*pixelsPerMeter+tagNr); // +tagNr to prevent overlap TODO: we don't want this in final visualisation
      
      var markerD3 = d3.select('.m-'+tagNr);
      
      if (tagData.coordinate) {
        var pos = toScreen(tagData.coordinate);
        markerD3.style('display', 'block');
        markerD3.attr('cx',pos.x);
        markerD3.attr('cy',pos.y);
        markerD3.style('fill', tagData.color); // TODO: dynamically create markers
      } else {
        markerD3.style('display', 'none'); 
      }
        
    }
    
  });
}

// return the index in tagsData for the tag with this epc 
function getTagNr(epc : string) {
  for (var i=0; i<serverState.tagsData.length; i++)
    if (serverState.tagsData[i].epc == epc)
      return i;
  
  return -1; // TODO: handle this error
}

function startRefreshInterval() {
  refreshInterval = <any>setInterval(refresh, 500); 
  // unfortunately Eclipse TypeScript is stupid and doesn't respect reference paths, so it includes all TypeScript
  // declarations in the source tree and assumes a different type for setInterval here
  // (returning NodeTimer instead of number, as declared in node.d.ts)
}

function stopRefreshInterval() {
  <any>clearInterval(<any>refreshInterval); // see Eclipse TypeScript comment above
}

function refresh() {
  $.getJSON( 'query/tags', function( data ) {
    serverState = data;
    updateTags();
  }) .fail(function(jqXHR : any, status : any, err : any) {
    console.error( "Error:\n\n" + jqXHR.responseText );
  });
}

function connectReader() {
  $.get('/query/connect', function() {
    util.log('Connected to reader.');
    startRefreshInterval();
  });
}

function disconnectReader() {
  $.get('/query/disconnect', function() {
    util.log('Disconnected from reader.');
    stopRefreshInterval();  
  });
}

function handleConnectButton() {
  connectReader();
}

function handleDisconnectButton() {
  disconnectReader();
}

function handleToggleTagLocationsButton() {
  util.log('test:' + $('#annotation-plane').css('display')=='none');
  
  if ($('#annotation-plane').css('display')=='none') {
    $('#toggle-locations-button').attr('value','Show tag locations');
    $('#annotation-plane').show();
  } else {
    $('#toggle-locations-button').attr('value','Hide tag locations');
    $('#annotation-plane').hide();
  }
}

// convert coordinate in meters to pixels
function toScreen(coord : {x : number; y : number }) {
  return {x: coord.x*pixelsPerMeter + origin.x, y: coord.y*pixelsPerMeter + origin.y};
}

var allAntennas : Shared.Antenna[];
 
var tagCoords =
  [ {x:0,y:0}
  , {x:0.53,y:-0.53},{x:0.53,y:0.53},{x:-0.53,y:0.53},{x:-0.53,y:-0.53}
  , {x:1.06,y:-1.06},{x:1.06,y:1.06},{x:-1.06,y:1.06},{x:-1.06,y:-1.06}
  , {x:1.42,y:0},{x:1.42,y:-50}
  ];
