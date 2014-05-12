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
  
var debug = true;
var floorHeight = 500;
var floorWidth = 700;

var origin = {x: floorWidth/2, y: floorHeight/2}; // pixel coordinates for (0,0)
var pixelsPerMeter = 80;


var refreshRate = 500;
var trailLength = 30;
var tagTrails : Shared.Coord[][] = [];

var refreshInterval : number; // setInterval() returns a number
var serverState : Shared.ServerState;
var allAntennas : Shared.Antenna[];
var allTagInfo : Shared.TagInfo[];

function initRefreshSocket(floorSVG : D3.Selection) {
  //util.log(location.host);
  var socket = io.connect('http://'+location.host);
  socket.on('llrp', function (data) {   
    //util.log('LLRP event'+data.RSSI);
  });
}  

/***** Initialization *****/

$(document).ready(function(){
  initialize();
});

// Duplicated, until we find an elegant way to share both types and code between client and server TypeScript
function initialServerState() : Shared.ServerState {
  return {
    visibleTags: [],
    status: {isConnected: false, isSaving: false, webServerTime : null, readerServerTime : null},
    tagsData: []
  };
}

function resetClientState() {
  serverState = initialServerState();
  tagTrails = [];
  d3.selectAll('#annotation-plane *').remove();
  d3.selectAll('#trilateration-plane *').remove();
  d3.selectAll('#rssi-plane *').remove();
  initTrails();
  createMarkers();
}

function initialize() {
  $.ajaxSetup({ cache: false });
  serverState = initialServerState();
  queryAntennas();
  queryTagInfo();
  var floorSVG = d3.select('#floor')
    .append('svg:svg')
    .attr('width', floorWidth)
    .attr('height', floorHeight);

  $('#floor').css('height',floorHeight+'px'); // for some reason height is rendered a bit too large, so we constrain it.

  floorSVG.append('g').attr('id', 'background-plane')
    .append('rect').attr('id', 'floor-background')
    .attr('width', floorWidth)
    .attr('height', floorHeight);
  floorSVG.append('g').attr('id', 'tag-info-plane');
  floorSVG.append('g').attr('id', 'annotation-plane');
  floorSVG.append('g').attr('id', 'rssi-plane');
  floorSVG.append('g').attr('id', 'antenna-plane');
  floorSVG.append('g').attr('id', 'trilateration-plane');
  floorSVG.append('g').attr('id', 'visitor-plane');

  drawAntennas();
  drawTagSetup();
  
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

function drawAntenna(planeSVG : D3.Selection, antenna : Shared.Antenna, antennaNr : number) {
  var pos = toScreen(antenna.coord);
  planeSVG.append('circle').attr('class', 'a-'+antennaNr)
    .style('stroke', 'white')
    .style('fill', 'blue')
    .attr('r', 8)
    .attr('cx', pos.x)
    .attr('cy', pos.y);
  planeSVG.append('text').text(''+antenna.name)
    .attr('x', pos.x-3)
    .attr('y', pos.y+3.5)
    .attr('font-family', 'verdana')
    .attr('font-size', '10px')
    .attr('fill', 'white');
  
}

// TODO: Maybe combine with query antennas so we can easily handle actions that require both to have finished
function queryTagInfo() {
  $.getJSON( 'query/tag-info', function( data ) {
    util.log('Queried tag info:\n'+JSON.stringify(data));
    allTagInfo = data;
    drawTagSetup();
    initTrails();
    createMarkers();
  }) .fail(function(jqXHR : any, status : any, err : any) {
    console.error( "Error:\n\n" + jqXHR.responseText );
  });
}

function drawTagSetup() {
  var tagInfoPlaneSVG = d3.select('#tag-info-plane');
  _(allTagInfo).each((tag, tagNr)=>{
    var tagCoord = toScreen(tag.coord);
    drawSquare(tagInfoPlaneSVG, tagCoord.x, tagCoord.y, 10, tag.color);
  });
}

function drawSquare(planeSVG : D3.Selection, x : number, y : number, size : number, color : string) {
  planeSVG.append('rect')
    .style('stroke', 'white')
    .style('fill', color)
    .attr('x', x-size/2)
    .attr('y', y-size/2)
    .attr('width', size)
    .attr('height', size);
}

function createMarkers() {
  _.map(_.range(0, allTagInfo.length), (i : number) => createMarker(i));
}

function createMarker(markerNr : number) {
  var trilaterationPlaneSVG = d3.select('#trilateration-plane');
 
  trilaterationPlaneSVG.append('circle').attr('class', 'm-'+markerNr)
    .style('stroke', 'white')
    .style('fill', 'yellow')
    .attr('r', 6)
    .attr('cx', toScreenX(0))
    .attr('cy', toScreenY(0))
    .style('display', 'none');
}

// Store coord at the head of the corresponding trail, moving up the rest, and clipping at trailLength.
function recordTrail(epc : string, coord : Shared.Coord) {
  var tagNr = getTagNr(epc);
  var tagTrail = tagTrails[tagNr];
  if (!tagTrail) { // create new trail if non-existent
    tagTrail = [];
    tagTrails[tagNr] = tagTrail;
  }
  tagTrails[tagNr] = _.union([coord], tagTrail).slice(0,trailLength);
}

function initTrails() {
  for (var tagNr=0; tagNr<allTagInfo.length; tagNr++) {
    var visitorTrail = d3.select('#annotation-plane')
      .append('path')
      .attr('id', 'trail-'+tagNr)
      .attr('class', 'tag-trail')
      .attr('stroke-dasharray','')
      //.style('stroke', allTagInfo[tagNr].color)
      .attr('fill', 'none');
  }
}

function updateTrails() {
  // TODO: handle new tags and disappeared tags
  _.each(serverState.tagsData, (tagData) => {
    var tagNr = getTagNr(tagData.epc);
    var tagTrail = tagTrails[tagNr];
    
    if (tagTrail) {
      var lineFunction = d3.svg.line()
        .x(function(d) { return toScreenX(d.x); })
        .y(function(d) { return toScreenY(d.y); })
        .interpolate('linear');
    
      d3.select('#trail-'+tagNr)
        .attr('d', lineFunction(tagTrail.slice(1)))
        .attr('stroke-dasharray','')
        .style('stroke', tagData.color)
        .style('stroke-opacity', 0.5)
        .attr('fill', 'none');
    }
  });
}

function updateLabels() {
  $('#client-time-label').text(showTime(new Date()));
  $('#server-time-label').text(showTime(new Date(serverState.status.webServerTime)));
  if (serverState.status.readerServerTime)
    $('#reader-time-label').text(showTime(new Date(serverState.status.readerServerTime)));
  $('#reader-time-label').css('color', serverState.status.isConnected ? 'white' : 'grey');

  $('#connection-label').text(serverState.status.isConnected ? 'Connected' : 'Not connected');
  $('#connection-label').css('color', serverState.status.isConnected ? 'lime' : 'red');
}

function updateTags() {
  updateLabels();
    
  var rssiPlaneSVG = d3.select('#rssi-plane');
  var now = new Date();
  _.map(serverState.tagsData, (tagData) => {
    //util.log(tagRssis.epc + '(' + tagNr + ':' + tagColors[tagNr] + ')' + tagRssis.rssis);
    var tagNr = getTagNr(tagData.epc);
    //$('.tag-rssis:eq('+tagNr+') .tag-label').text(tagData.epc);
    var $tagLabel = $('.tag-rssis:eq('+tagNr+') .tag-label');
    $tagLabel.css('color',tagData.color);
    $tagLabel.text(tagNr + ' ' +tagData.epc.slice(-7));
    for (var ant=0; ant<allAntennas.length; ant++) {
      if (tagData.rssis[ant]) {
        //util.log('epc:'+tagData.epc+'  '+tagNr);
        var rssi = tagData.rssis[ant].value;
        var signalAge = tagData.rssis[ant].age;
        var dist =  tagData.rssis[ant].distance;
        // show in table
        if (rssi) {
          $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+ant+')').html('<span class="dist-label">' + dist.toFixed(1) + '</span>' +
                                                                   '<span class="rssi-label">(' + rssi + ')</span>');
        }
        //util.log(tagNr + '-' + ant +' '+ rssi);
  
        var rangeClass = 'r-'+(ant+1)+'-'+tagNr; 
        var range = d3.select('.'+rangeClass)
        if (range.empty() && tagNr <=11) { // use <= to filter tags
          util.log('Creating range for antenna '+(ant+1) + ': '+rangeClass);
          
          var pos = toScreen(allAntennas[ant].coord);
          range = rssiPlaneSVG.append('circle').attr('class', rangeClass)
                    .style('stroke', tagData.color)
                    .style('fill', 'transparent')
                    .attr('cx', pos.x)
                    .attr('cy', pos.y);
        }
        //util.log('A'+ant+': tag'+tagNr+': '+dist);
        var isRangeOutdated = signalAge>2000; // todo: do this server side
        var isTrilaterationOutdated = false; // todo add timestamp to trilateration (and first try to trilaterate with only fresh ranges)
        range.transition()
             .duration(refreshRate)
             .style('stroke-dasharray', isRangeOutdated ? '5,2' : '')
             .attr('r', dist*pixelsPerMeter+tagNr); // +tagNr to prevent overlap TODO: we don't want this in final visualisation        
      }       
    }
    var markerD3 = d3.select('.m-'+tagNr);
    
    if (tagData.coordinate) {
      recordTrail(tagData.epc, tagData.coordinate);  // TODO: no coordinate case?
      var pos = toScreen(tagData.coordinate);
      markerD3.style('display', 'block');
      markerD3.transition()
              .duration(refreshRate)
              .style('stroke-dasharray', isTrilaterationOutdated ? '1,1' : '')
              .attr('cx',pos.x)
              .attr('cy',pos.y);
      markerD3.style('fill', tagData.color); // TODO: dynamically create markers
    } else {
      markerD3.style('display', 'none'); 
    }

  });
  updateTrails();
}

// return the index in tagsData for the tag with this epc 
function getTagNr(epc : string) {
  for (var i=0; i<serverState.tagsData.length; i++)
    if (serverState.tagsData[i].epc == epc)
      return i;
  
  return -1; // TODO: handle this error
}

function startRefreshInterval() {
  refreshInterval = <any>setInterval(refresh, refreshRate); 
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
  }).fail(function(jqXHR : JQueryXHR, status : any, err : any) {
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
    serverState.status.isConnected = false;
    updateLabels();  
  });
}

function handleConnectButton() {
  connectReader();
}

function handleDisconnectButton() {
  disconnectReader();
}

function handleResetButton() {
  $.get('/query/reset', function() {
    resetClientState();
    util.log('Reset server.');
  });
}

function handleSaveButton() {
  if ($('#save-button').val() == 'Start saving') { // Not the prettiest way, but it saves us from keeping another state variable for isSaving
    var filename = encodeURI($('#filename-field').val());
    util.setAttr($('#save-button'), 'disabled', true);
    $.get('/query/start-saving', {filename: filename}, function() {
      util.log('Started saving events.');
      $('#save-button').val('Stop saving');
      util.setAttr($('#save-button'), 'disabled', false);
    }).fail(function(data : JQueryXHR) {
      console.log(data);
      alert('Save failed:\n'+JSON.parse(data.responseText).error);
      util.setAttr($('#save-button'), 'disabled', false);
    });
  } else {
    $.get('/query/stop-saving', {filename: filename}, function() {
      util.log('Stopped saving events.');
      $('#save-button').val('Start saving');
    }); // Assuma that stop won't fail
        
  }
}

function handleToggleTagLocationsButton() {
  if ($('#tag-info-plane').css('display')=='none') {
    $('#toggle-locations-button').attr('value','Show tag locations');
    $('#tag-info-plane').show();
  } else {
    $('#toggle-locations-button').attr('value','Hide tag locations');
    $('#tag-info-plane').hide();
  }
}

// convert coordinate in meters to pixels
function toScreen(coord : {x : number; y : number }) {
  return {x: toScreenX(coord.x), y: toScreenY(coord.y)};
}

function toScreenX(x : number) {
  return x*pixelsPerMeter + origin.x;
}

function toScreenY(y : number) {
  return y*pixelsPerMeter + origin.y
}

function showTime(date : Date) {
  return util.padZero(2, date.getHours()) + ":" + util.padZero(2, date.getMinutes()) + ":" + util.padZero(2, date.getSeconds()) 
}
