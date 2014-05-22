/// <reference path="../typings/d3/d3.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />
/// <reference path="./ClientCommon.ts" />

export interface Dummy {}; // Dummy export causes Eclipse-TypeScript to not put this file's declarations in the global namespace (code generation is not affected)

var common = ClientCommon;

$(document).ready(function(){
  initialize();
});

var debug = true;
var floorHeight = 0;
var floorWidth = 0;

var origin = {x: floorWidth/2, y: floorHeight/2}; // pixel coordinates for (0,0)
var scale = 80; // pixels per meter


var refreshDelay = 500;
var trailLength = 30;
var tagTrails : Shared.Coord[][] = [];

var refreshInterval : number; // setInterval() returns a number
var serverState : Shared.ServerState;
var allAntennas : Shared.Antenna[];
var allTagInfo : Shared.TagInfo[];
  
/***** Initialization *****/

function resetClientState() {
  tagTrails = [];
  d3.selectAll('#annotation-plane *').remove();
  d3.selectAll('#antenna-plane *').remove();
  d3.selectAll('#tag-info-plane *').remove();
  d3.selectAll('#rssi-plane *').remove();
  d3.selectAll('#trilateration-plane *').remove();
  $('.tag-rssis .tag-label').text('');
  $('.tag-rssis .ant-rssi').html('');
  ClientCommon.drawTagSetup();
  ClientCommon.drawAntennas();
  initTrails();
  ClientCommon.createMarkers();
}

 function initialize() {
  $.ajaxSetup({ cache: false });
  serverState = Shared.initialServerState();
  initLayoutSelector();
  queryTagInfo();
  var floorSVG = d3.select('#floor')
    .append('svg:svg')
    .attr('width', floorWidth)
    .attr('height', floorHeight);
  
  var backgroundPlane = floorSVG.append('g').attr('id', 'background-plane');
  
  backgroundPlane.append('rect').attr('id', 'floor-background-rect')
    .attr('width', floorWidth)
    .attr('height', floorHeight);
  backgroundPlane.append('image').attr('id', 'floor-background-image')
    .attr('width', floorWidth)
    .attr('height', floorHeight);
    
  floorSVG.append('g').attr('id', 'annotation-plane');
  floorSVG.append('g').attr('id', 'antenna-plane');
  floorSVG.append('g').attr('id', 'tag-info-plane');
  floorSVG.append('g').attr('id', 'rssi-plane');
  floorSVG.append('g').attr('id', 'trilateration-plane');
  floorSVG.append('g').attr('id', 'visitor-plane');

  startRefreshInterval();
}

function initLayoutSelector() {
  $.getJSON( "query/layout-info", function(layoutInfo : Shared.LayoutInfo) {
    $.each(layoutInfo.names, function( index, name ) {
      $('#layout-selector').append('<option value="'+name+'">'+name+'</option>');
    });
    selectLayout(layoutInfo.selectedLayout);
  });
}

// TODO: Maybe combine with query antennas so we can easily handle actions that require both to have finished
function queryTagInfo() {
  $.getJSON( 'query/tag-info', function(newTagInfo : Shared.TagInfo[]) {
    util.log('Queried tag info:\n'+JSON.stringify(newTagInfo));
    allTagInfo = newTagInfo;
    ClientCommon.drawTagSetup();
    initTrails();
    ClientCommon.createMarkers();
  }) .fail(function(jqXHR : any, status : any, err : any) {
    console.error( "Error:\n\n" + jqXHR.responseText );
  });
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
      .attr('stroke-dasharray','none')
      //.style('stroke', allTagInfo[tagNr].color)
      .attr('fill', 'none');
  }
}

function updateTrails() {
  // TODO: handle new tags and disappeared tags
  _.each(serverState.tagsData, (tagData) => {
    var tagNr = getTagNr(tagData.epc);
    var color = getTagInfo(tagData.epc).color;
    var tagTrail = tagTrails[tagNr];
    
    if (tagTrail) {
      var lineFunction = d3.svg.line()
        .x(function(d) { return ClientCommon.toScreenX(d.x); })
        .y(function(d) { return ClientCommon.toScreenY(d.y); })
        .interpolate('linear');
    
      d3.select('#trail-'+tagNr)
        .attr('d', lineFunction(tagTrail.slice(1)))
        .attr('stroke-dasharray','none')
        .style('stroke', color)
        .style('stroke-opacity', 0.5)
        .attr('fill', 'none');
    }
  });
}

function updateLabels() {
  $('#client-time-label').text(ClientCommon.showTime(new Date()));
  $('#server-time-label').text(ClientCommon.showTime(new Date(serverState.status.webServerTime)));
  if (serverState.status.readerServerTime)
    $('#reader-time-label').text(ClientCommon.showTime(new Date(serverState.status.readerServerTime)));
  $('#reader-time-label').css('color', serverState.status.isConnected ? 'white' : 'grey');

  $('#connection-label').text(serverState.status.isConnected ? 'Connected' : 'Not connected');
  $('#connection-label').css('color', serverState.status.isConnected ? 'lime' : 'red');
}

function updateTags() {
  updateLabels();
    
  var rssiPlaneSVG = d3.select('#rssi-plane');
  var now = new Date();
  var unknownAntennasHtml = serverState.unknownAntennaIds.length == 0 ? 'None' :
    _(serverState.unknownAntennaIds).map((unknownAntenna) => {
      return '<div id="unknown-antenna">' + unknownAntenna.readerIp + '-' + unknownAntenna.antennaNr + '</div>';
    }).join('');
  $('#unknown-antennas').html(unknownAntennasHtml);
  _.map(serverState.tagsData, (tagData) => {
    //util.log(tagRssis.epc + '(' + tagNr + ':' + tagColors[tagNr] + ')' + tagRssis.rssis);
    var tagNr = getTagNr(tagData.epc);
    var color = getTagInfo(tagData.epc).color;
    //$('.tag-rssis:eq('+tagNr+') .tag-label').text(tagData.epc);
    var $tagLabel = $('.tag-rssis:eq('+tagNr+') .tag-label');
    $tagLabel.css('color', color);
    $tagLabel.text(tagNr + ' ' +tagData.epc.slice(-7));
    
      for (var i=0; i < tagData.antennaRssis.length; i++) {
      var antRssi = tagData.antennaRssis[i];
      var antNr = antRssi.antNr;
      //util.log('epc:'+tagData.epc+'  '+tagNr);
      var rssi = antRssi.value;
      var signalAge = antRssi.age;
      var dist =  antRssi.distance;
      var isRangeRecent = signalAge<2000; // todo: do this server side
      // show in table
      if (rssi) {
        $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+antNr+')').html('<span class="dist-label">' + dist.toFixed(1) + 'm</span>' +
                                                                 '<span class="rssi-label">(' + rssi.toFixed(1) + ')</span>');
        $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+antNr+') .dist-label').css('color', isRangeRecent ? 'white' : 'red');
        $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+antNr+') .rssi-label').css('color', isRangeRecent ? '#bbb' : 'red');
      }
      //util.log(tagNr + '-' + ant +' '+ rssi);

      var rangeClass = 'r-'+(antNr+1)+'-'+tagNr; 
      var range = d3.select('.'+rangeClass)
      if (range.empty() && tagNr <=11) { // use <= to filter tags
        util.log('Creating range for antenna '+antNr + ': '+rangeClass);
        
        var pos = ClientCommon.toScreen(allAntennas[antNr].coord);
        range = rssiPlaneSVG.append('circle').attr('class', rangeClass)
                  .style('stroke', color)
                  .style('fill', 'transparent')
                  .attr('cx', pos.x)
                  .attr('cy', pos.y);
      }
      //util.log('A'+ant+': tag'+tagNr+': '+dist);
      range.transition()
           .duration(refreshDelay)
           .style('stroke-dasharray', isRangeRecent ? 'none' : '5,2')
           .attr('r', dist*scale+tagNr); // +tagNr to prevent overlap TODO: we don't want this in final visualisation          
    }
    var markerD3 = d3.select('.m-'+tagNr);
    
    if (tagData.coordinate && tagData.coordinate.coord) {
      recordTrail(tagData.epc, tagData.coordinate.coord);  // TODO: no coordinate case?
      var pos = ClientCommon.toScreen(tagData.coordinate.coord);
      markerD3.style('display', 'block');
      markerD3.style('fill', color) // TODO: dynamically create markers
            .style('stroke', tagData.coordinate.isRecent ? 'white' : 'red');
      markerD3.transition()
              .duration(refreshDelay)
              .attr('cx',pos.x)
              .attr('cy',pos.y);
    } else {
      markerD3.style('display', 'none'); 
    }

  });
  updateTrails();
}

function selectLayout(layoutNr : number) {
  util.log('Selecting layout '+layoutNr);
  (<HTMLSelectElement>$('#layout-selector').get(0)).selectedIndex = layoutNr;
  $.getJSON( 'query/select-layout/'+layoutNr, function(antennaInfo : Shared.AntennaInfo) {
    allAntennas = antennaInfo.antennaSpecs;
    scale = antennaInfo.scale;
    ClientCommon.resizeFloor(antennaInfo.dimensions);
    ClientCommon.setBackgroundImage(antennaInfo.backgroundImage);
    resetClientState();
  }) .fail(function(jqXHR : any, status : any, err : any) {
    console.error( "Error:\n\n" + jqXHR.responseText );
  });
}
  
function startRefreshInterval() {
  refreshInterval = <any>setInterval(refresh, refreshDelay); 
  // unfortunately Eclipse TypeScript is stupid and doesn't respect reference paths, so it includes all TypeScript
  // declarations in the source tree and assumes a different type for setInterval here
  // (returning NodeTimer instead of number, as declared in node.d.ts)
}

function stopRefreshInterval() {
  <any>clearInterval(<any>refreshInterval); // see Eclipse TypeScript comment above
}

function refresh() {
  $.getJSON( 'query/tags', function(newServerState : Shared.ServerState) {
    var oldSelectedAntennaLayout = serverState.selectedAntennaLayout;
    serverState = newServerState;
    if (serverState.selectedAntennaLayout != oldSelectedAntennaLayout)
      selectLayout(serverState.selectedAntennaLayout);
    updateTags();
  }).fail(function(jqXHR : JQueryXHR, status : any, err : any) {
    resetClientState();
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

function handleStartRefreshButton() {
  startRefreshInterval();
}

function handleStopRefreshButton() {
  stopRefreshInterval();
}

function handleConnectButton() {
  connectReader();
}

function handleDisconnectButton() {
  disconnectReader();
}

function handleResetButton() {
  stopRefreshInterval();
  $.get('/query/reset', function() {
    resetClientState();
    serverState = Shared.initialServerState();
    util.log('Server and client were reset.');
    startRefreshInterval();
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
    }); // Assume that stop won't fail
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

function handleSelectLayout(selectElt : HTMLSelectElement) {
  selectLayout(selectElt.selectedIndex);
}

// return the index in tagsData for the tag with this epc 
function getTagNr(epc : string) {
  return _(serverState.tagsData).pluck('epc').indexOf(epc);
}

function getTagInfo(epc : string) {
  var ix = _(allTagInfo).pluck('epc').indexOf(epc);
  if (ix == -1) {
    console.log('Tag with epc %s not found in allTagInfo',epc)
    return {epc:epc, color:'white', coord:null}
  } else {
    return allTagInfo[ix];
  }
}

