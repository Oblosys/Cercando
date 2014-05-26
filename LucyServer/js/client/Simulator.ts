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

var nrOfGeneratedTags = 4;

var refreshRate = 500;
var trailLength = 30;
var tagTrails : Shared.Coord[][] = [];

var refreshInterval : number; // setInterval() returns a number
var serverState : Shared.ServerState;
var allAntennas : Shared.Antenna[];
var tagConfiguration : Shared.TagConfiguration[];
  
var UIState = Backbone.Model.extend({
  defaults: {
    showMaxAntennaRanges: false,
    showTagSetup: true
  }
});

var uiState : Backbone.Model = new UIState();

/***** Initialization *****/

function resetClientState() {
  tagTrails = [];

  uiState.set('showMaxAntennaRanges', true);
  uiState.trigger('change'); // reflect current values in UI, even when they are not different from defaults (and don't fire change  event)

  d3.selectAll('#trail-plane *').remove();
  d3.selectAll('#antenna-plane *').remove();
  d3.selectAll('#tag-setup-plane *').remove();
  d3.selectAll('#rssi-plane *').remove();
  d3.selectAll('#trilateration-plane *').remove();
  $('.tag-rssis .tag-label').text('');
  $('.tag-rssis .ant-rssi').html('');
  ClientCommon.drawTagSetup();
  ClientCommon.createAntennaMarkers();
  setAntennasDragHandler();
  generateTags(nrOfGeneratedTags);
 }

function initialize() {
  $.ajaxSetup({ cache: false });
  serverState = Shared.initialServerState();

  uiState.on('change', handleUIStateChange);
  initSelectorButtons();
  
  ClientCommon.initFloorSVG();

  initLayoutSelector(); // initLayoutSelector calls selectLayout, which finishes client init and starts refresh interval
}

function initSelectorButtons() {
  $('#show-ranges-selector .select-button:eq(0)').on('click', () => {uiState.set('showMaxAntennaRanges', true)});
  $('#show-ranges-selector .select-button:eq(1)').on('click', () => {uiState.set('showMaxAntennaRanges', false)});
  $('#show-tag-setup-selector .select-button:eq(0)').on('click', () => {uiState.set('showTagSetup', true)});
  $('#show-tag-setup-selector .select-button:eq(1)').on('click', () => {uiState.set('showTagSetup', false)});
}

function handleUIStateChange(m : Backbone.Model, newValue : any) {
 // util.log('handleUIStateChange', m, newValue); // note that m and newValue not set on trigger('change')
  var showMaxAntennaRanges = uiState.get('showMaxAntennaRanges');
  util.setAttr($('#show-ranges-selector .select-button:eq(0)'),'selected', showMaxAntennaRanges);
  util.setAttr($('#show-ranges-selector .select-button:eq(1)'),'selected', !showMaxAntennaRanges);
  $('#antenna-range-plane').attr('visibility', showMaxAntennaRanges ? 'visible' : 'hidden');
  $('#antenna-range-background-plane').attr('visibility', showMaxAntennaRanges ? 'visible' : 'hidden');
  var showTagSetup = uiState.get('showTagSetup');
  util.setAttr($('#show-tag-setup-selector .select-button:eq(0)'),'selected', showTagSetup);
  util.setAttr($('#show-tag-setup-selector .select-button:eq(1)'),'selected', !showTagSetup);
  $('#tag-setup-plane').attr('visibility', showTagSetup ? 'visible' : 'hidden');
}

function initLayoutSelector() {
  $.getJSON( "query/layout-info", function(layoutInfo : Shared.LayoutInfo) {
    $.each(layoutInfo.names, function( index, name ) {
      $('#layout-selector').append('<option value="'+name+'">'+name+'</option>');
    });
    selectLayout(layoutInfo.selectedLayoutNr);
  });
}

function setAntennasDragHandler() {
  var drag = d3.behavior.drag()
    .on("drag", function(d,i) {
      $(this).attr('transform', 'translate('+d3.event.x+','+d3.event.y+')');
      var x = ClientCommon.fromScreenX(d3.event.x);
      var y = ClientCommon.fromScreenY(d3.event.y);
      var splitId = $(this).attr('id').split('-');
      var antennaNr : number = 0; 
      if (splitId.length > 0)
        antennaNr = parseInt(splitId[1]);
      else
        util.log('Incorrect antenna id: \'' + $(this).attr('id') + '\'');
      $.get('/query/move-antenna/'+antennaNr+'/'+x+'/'+y, function() {}); // simply send all drag events to server (only meant for local connection)
    });
  d3.selectAll('.antenna-marker').call(drag);
}

function generateTags(nrOfGeneratedVisitors : number) {
  var tags : Shared.TagData[] =   
    _(_.range(nrOfGeneratedVisitors)).map((i) => {
      var coord = i==0 ? {x:0.0, y:0} : { x:ClientCommon.fromScreenX(Math.random()*0.8*floorWidth + 0.1*floorWidth)
                                        , y:ClientCommon.fromScreenY(Math.random()*0.8*floorHeight + 0.1*floorHeight) }
      return {epc: util.padZero(31, i), antennaRssis: [], coordinate:{coord: coord, isRecent: true}};
    });
  _(tags).each((tag) => {
    
    generateTag(tag);
    //createVisitor(visitor);
  });
  $.get('/query/set-all-tags', {allTags: JSON.stringify(tags)}, function() {}); 
}

// Create a tag marker with a larger radius and an attached drag handler
function generateTag(tag : Shared.TagData) {
  ClientCommon.createTagMarker(tag);
  var tagSVG = d3.select('#' + ClientCommon.mkTagId(tag));
  var drag = d3.behavior.drag()
    .on("drag", function(d,i) {
      $(this).attr('cx', d3.event.x)
             .attr('cy', d3.event.y);
      var x = ClientCommon.fromScreenX(d3.event.x);
      var y = ClientCommon.fromScreenY(d3.event.y);
      $.get('/query/set-tag/'+tag.epc+'/'+x+'/'+y, function() {}); // simply send all drag events to server (only meant for local connection)
    });
  tagSVG.attr('r', 8).call(drag);
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

function selectLayout(layoutNr : number) {
  util.log('Selecting layout '+layoutNr);
  (<HTMLSelectElement>$('#layout-selector').get(0)).selectedIndex = layoutNr;
  $.getJSON( 'query/select-layout/'+layoutNr, function(antennaInfo : Shared.AntennaInfo) {
    serverState.selectedAntennaLayoutNr = layoutNr;
    allAntennas = antennaInfo.antennaSpecs;
    tagConfiguration = antennaInfo.tagConfiguration;

    scale = antennaInfo.scale;
    ClientCommon.resizeFloor(antennaInfo.dimensions);
    ClientCommon.setBackgroundImage(antennaInfo.backgroundImage);
    resetClientState();
  }) .fail(function(jqXHR : any, status : any, err : any) {
    util.error( "Error:\n\n" + jqXHR.responseText );
  });
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
  util.error('refresh() not implemented');
}

function handleStartRefreshButton() {
  startRefreshInterval();
}

function handleStopRefreshButton() {
  stopRefreshInterval();
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

function handleShowAntennaSpecButton() {
  window.location.href = 'query/reader-antenna-spec';
}

function handleSelectLayout(selectElt : HTMLSelectElement) {
  selectLayout(selectElt.selectedIndex);
}
