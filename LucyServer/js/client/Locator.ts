/// <reference path="../typings/d3/d3.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />
/// <reference path="./ClientCommon.ts" />

export interface Dummy {}; // Dummy export causes Eclipse-TypeScript to not put this file's declarations in the global namespace (code generation is not affected)

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

var UIState = Backbone.Model.extend({
  defaults: {
    showMaxAntennaRanges: false
  }
});

var uiState : Backbone.Model = new UIState();

/***** Initialization *****/

function resetClientState() {
  util.log('Resetting client state');
  uiState.set('showMaxAntennaRanges', false);
  uiState.trigger('change'); // reflect current values in UI, even when they are not different from defaults (and don't fire change  event)

  tagTrails = [];
  d3.selectAll('#annotation-plane *').remove();
  d3.selectAll('#antenna-plane *').remove();
  d3.selectAll('#tag-info-plane *').remove();
  d3.selectAll('#rssi-plane *').remove();
  d3.selectAll('#trilateration-plane *').remove();
  $('.tag-rssis .tag-label').text('');
  $('.tag-rssis .ant-rssi').html('');
  ClientCommon.drawTagSetup();
  ClientCommon.createAntennaMarkers();

  initTrails();
}

function initialize() {
  $.ajaxSetup({ cache: false });
  serverState = Shared.initialServerState();

  uiState.on('change', handleUIStateChange);
  initSelectorButtons();
  
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

function initSelectorButtons() {
  $('#show-range-selector .select-button:eq(0)').on('click', () => {uiState.set('showMaxAntennaRanges', true)});
  $('#show-range-selector .select-button:eq(1)').on('click', () => {uiState.set('showMaxAntennaRanges', false)});
}

function handleUIStateChange(m : Backbone.Model, newValue : any) {
  util.log('handleUIStateChange', m, newValue);
  var showMaxAntennaRanges = uiState.get('showMaxAntennaRanges');
  util.setAttr($('#show-range-selector .select-button:eq(0)'),'selected', showMaxAntennaRanges);
  util.setAttr($('#show-range-selector .select-button:eq(1)'),'selected', !showMaxAntennaRanges);
  $('#antenna-plane .antenna-max-range').attr('visibility', showMaxAntennaRanges ? 'visible' : 'hidden');
}

function initLayoutSelector() {
  $.getJSON( "query/layout-info", function(layoutInfo : Shared.LayoutInfo) {
    $.each(layoutInfo.names, function( index, name ) {
      $('#layout-selector').append('<option value="'+name+'">'+name+'</option>');
    });
    selectLayout(layoutInfo.selectedLayoutNr);
  });
}

// TODO: Maybe combine with query antennas so we can easily handle actions that require both to have finished
function queryTagInfo() {
  $.getJSON( 'query/tag-info', function(newTagInfo : Shared.TagInfo[]) {
    //util.log('Queried tag info:\n'+JSON.stringify(newTagInfo));
    allTagInfo = newTagInfo;
    ClientCommon.drawTagSetup();
    initTrails();
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

// TODO: maybe use D3 for adding and removing?
function addRemoveSVGElements(oldTagsData : Shared.TagData[], currentTagsData : Shared.TagData[]) {
  // Remove disappeared signals and tags
  _(oldTagsData).each((oldTag) => {
    var currentTag = _(currentTagsData).findWhere({epc: oldTag.epc});
    _(oldTag.antennaRssis).each((oldAntennaRssi) => { // todo: refactor pluck call
      if (!currentTag || !_(_(currentTag.antennaRssis).pluck('antNr')).contains(oldAntennaRssi.antNr)) {
        util.log('Removed signal for antenna ' + oldAntennaRssi.antNr + ' for tag ' + oldTag.epc); 
        ClientCommon.removeSignalMarker(oldAntennaRssi, oldTag);
      }
    });
    if (!currentTag) {
      util.log('Removed tag ' + oldTag.epc); 
      ClientCommon.removeTagMarker(oldTag);
    }
  });

  // Add newly-appeared signals and tags
  _(currentTagsData).each((currentTag) => {
    var oldTag = _(oldTagsData).findWhere({epc: currentTag.epc});
    _(currentTag.antennaRssis).each((currentAntennaRssi) => { // todo: refactor pluck call
      if (!oldTag || !_(_(oldTag.antennaRssis).pluck('antNr')).contains(currentAntennaRssi.antNr)) {
        util.log('New signal for antenna ' + currentAntennaRssi.antNr + ' for tag ' + currentTag.epc); 
        ClientCommon.createSignalMarker(currentAntennaRssi, currentTag);
      }
    });
    if (!oldTag) {
      util.log('New tag ' + currentTag.epc); 
      ClientCommon.createTagMarker(currentTag);
    }
  });
}

function updateTrails() {
  // TODO: handle new tags and disappeared tags
  _.each(serverState.tagsData, (tagData) => {
    var tagNr = getTagNr(tagData.epc);
    var color = ClientCommon.getTagInfo(tagData.epc).color;
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
    
  var now = new Date();
  var unknownAntennasHtml = serverState.unknownAntennaIds.length == 0 ? 'None' :
    _(serverState.unknownAntennaIds).map((unknownAntenna) => {
      return '<div id="unknown-antenna">' + unknownAntenna.readerIp + '-' + unknownAntenna.antennaNr + '</div>';
    }).join('');
  $('#unknown-antennas').html(unknownAntennasHtml);
  _.map(serverState.tagsData, (tagData) => {
    //util.log(tagRssis.epc + '(' + tagNr + ':' + tagColors[tagNr] + ')' + tagRssis.rssis);
    var tagNr = getTagNr(tagData.epc);
    var color = ClientCommon.getTagInfo(tagData.epc).color;
    //$('.tag-rssis:eq('+tagNr+') .tag-label').text(tagData.epc);
    var $tagLabel = $('.tag-rssis:eq('+tagNr+') .tag-label');
    $tagLabel.css('color', color);
    $tagLabel.text(tagNr + ' ' +tagData.epc.slice(-7));
    
      for (var i=0; i < tagData.antennaRssis.length; i++) {
      var antRssi = tagData.antennaRssis[i];
      var antNr = antRssi.antNr;
      //util.log('epc:'+tagData.epc+'  '+tagNr);
      var rssi = antRssi.value;
      var dist =  antRssi.distance;
      var isSignalRecent = Shared.isRecentAntennaRSSI(antRssi);
        
      // show in table
      if (rssi) {
        $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+antNr+')').html('<span class="dist-label">' + dist.toFixed(1) + 'm</span>' +
                                                                 '<span class="rssi-label">(' + rssi.toFixed(1) + ')</span>');
        $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+antNr+') .dist-label').css('color', isSignalRecent ? 'white' : 'red');
        $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+antNr+') .rssi-label').css('color', isSignalRecent ? '#bbb' : 'red');
      }
      //util.log(tagNr + '-' + ant +' '+ rssi);

      var signal = d3.select('#'+ClientCommon.mkSignalId(antRssi, tagData));
      if (signal.empty())
        ClientCommon.createSignalMarker(antRssi, tagData);
        
      //util.log('A'+ant+': tag'+tagNr+': '+dist);
      ClientCommon.setSignalMarkerRssi(antRssi, tagData);
    }
    var markerD3 = d3.select('#' + ClientCommon.mkTagId(tagData));
    
    if (tagData.coordinate && tagData.coordinate.coord) {
      recordTrail(tagData.epc, tagData.coordinate.coord);  // TODO: no coordinate case?
      var pos = ClientCommon.toScreen(tagData.coordinate.coord);
      markerD3.style('display', 'block');
      markerD3.style('fill', color)
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
    //util.log(JSON.stringify('old epcs: '+_(serverState.tagsData).pluck('epc')));
    //util.log(JSON.stringify('new epcs: '+_(newServerState.tagsData).pluck('epc')));
    addRemoveSVGElements(serverState.tagsData, newServerState.tagsData)

    var oldSelectedAntennaLayoutNr = serverState.selectedAntennaLayoutNr;    
    serverState = newServerState;
    if (serverState.selectedAntennaLayoutNr != oldSelectedAntennaLayoutNr)
      selectLayout(serverState.selectedAntennaLayoutNr);

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
