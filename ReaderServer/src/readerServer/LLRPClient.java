package readerServer;
import java.util.Date;
import java.util.List;

import org.llrp.ltk.generated.enumerations.*;
import org.llrp.ltk.generated.messages.*;
import org.llrp.ltk.generated.parameters.*;
import org.llrp.ltk.net.*;
import org.llrp.ltk.types.*;
 
/**
 * Class that initializes an LLRP connection with the RFID reader and passes all read events
 * on to the client socket.
 * 
 * @author Martijn Schrage - Oblomov Systems
 * @author Mike Lenehan
 * 
 */
public class LLRPClient implements LLRPEndpoint {
  private LLRPConnection reader;
  private static final int TIMEOUT_MS = 10000;
  private static final int ROSPEC_ID = 1;
   
  private String readerIP;
  
  public LLRPClient(String readerIP) {
    this.readerIP = readerIP;
  }
  
  // Build the ROSpec.
  // An ROSpec specifies start and stop triggers,
  // tag report fields, antennas, etc.
  public ROSpec buildROSpec() { 
    //Util.log("Building the ROSpec.");
     
    // Create a Reader Operation Spec (ROSpec).
    ROSpec roSpec = new ROSpec();
     
    roSpec.setPriority(new UnsignedByte(0));
    roSpec.setCurrentState(new ROSpecState(ROSpecState.Disabled));
    roSpec.setROSpecID(new UnsignedInteger(ROSPEC_ID));
     
    // Set up the ROBoundarySpec
    // This defines the start and stop triggers.
    ROBoundarySpec roBoundarySpec = new ROBoundarySpec();
     
    // Set the start trigger to null.
    // This means the ROSpec will start as soon as it is enabled.
    ROSpecStartTrigger startTrig = new ROSpecStartTrigger();
    startTrig.setROSpecStartTriggerType
        (new ROSpecStartTriggerType(ROSpecStartTriggerType.Null));
    roBoundarySpec.setROSpecStartTrigger(startTrig);
     
    // Set the stop trigger is null. This means the ROSpec
    // will keep running until an STOP_ROSPEC message is sent.
    ROSpecStopTrigger stopTrig = new ROSpecStopTrigger();
    stopTrig.setDurationTriggerValue(new UnsignedInteger(0));
    stopTrig.setROSpecStopTriggerType
        (new ROSpecStopTriggerType(ROSpecStopTriggerType.Null));
    roBoundarySpec.setROSpecStopTrigger(stopTrig);
     
    roSpec.setROBoundarySpec(roBoundarySpec);
     
    // Add an Antenna Inventory Spec (AISpec).
    AISpec aispec = new AISpec();
     
    // Set the AI stop trigger to null. This means that
    // the AI spec will run until the ROSpec stops.
    AISpecStopTrigger aiStopTrigger = new AISpecStopTrigger();
    aiStopTrigger.setAISpecStopTriggerType
        (new AISpecStopTriggerType(AISpecStopTriggerType.Null));
    aiStopTrigger.setDurationTrigger(new UnsignedInteger(0));
    aispec.setAISpecStopTrigger(aiStopTrigger);
     
    // Select which antenna ports we want to use.
    // Setting this property to zero means all antenna ports.
    UnsignedShortArray antennaIDs = new UnsignedShortArray();
    antennaIDs.add(new UnsignedShort(0));
    aispec.setAntennaIDs(antennaIDs);
     
    // Tell the reader that we're reading Gen2 tags.
    InventoryParameterSpec inventoryParam = new InventoryParameterSpec();
    inventoryParam.setProtocolID
        (new AirProtocols(AirProtocols.EPCGlobalClass1Gen2));
    inventoryParam.setInventoryParameterSpecID(new UnsignedShort(1));
    
    
    // Added from https://support.impinj.com/entries/22885276-How-can-I-to-set-the-antenna-power-in-java- 
    // Configure the antennas
    /* 
    AntennaConfiguration antConfig = new AntennaConfiguration();
    // Antenna configuration applies to all antennas
    antConfig.setAntennaID(new UnsignedShort(0));

    // Transmit settings
    RFTransmitter tx = new RFTransmitter();
    tx.setTransmitPower(new UnsignedShort(200)); // 200 is max
    tx.setChannelIndex(new UnsignedShort(1));
    tx.setHopTableID(new UnsignedShort(1));
    antConfig.setRFTransmitter(tx);

    // Receiver settings
    RFReceiver rx = new RFReceiver();
    rx.setReceiverSensitivity(new UnsignedShort(1)); // only 1 is allowed?
    antConfig.setRFReceiver(rx);

    // Add the antenna configuration
    inventoryParam.addToAntennaConfigurationList(antConfig);
    // end of addition
     */
    
    
    aispec.addToInventoryParameterSpecList(inventoryParam);
     
    roSpec.addToSpecParameterList(aispec);
     
    // Specify what type of tag reports we want
    // to receive and when we want to receive them.
    ROReportSpec roReportSpec = new ROReportSpec();
    // Receive a report every time a tag is read.
    roReportSpec.setROReportTrigger(new ROReportTriggerType
        (ROReportTriggerType.Upon_N_Tags_Or_End_Of_ROSpec));
    roReportSpec.setN(new UnsignedShort(1)); // only unique tag/antenna pairs are counted, so we need to keep this 1
                                             // (if N > nrOfAntennas, one tag will never trigger a read event)
    TagReportContentSelector reportContent =
        new TagReportContentSelector();
    // Select which fields we want in the report.
    reportContent.setEnableAccessSpecID(new Bit(0));
    reportContent.setEnableAntennaID(new Bit(1));
    reportContent.setEnableChannelIndex(new Bit(1));
    reportContent.setEnableFirstSeenTimestamp(new Bit(1));
    reportContent.setEnableInventoryParameterSpecID(new Bit(0));
    reportContent.setEnableLastSeenTimestamp(new Bit(1));
    reportContent.setEnablePeakRSSI(new Bit(1));
    reportContent.setEnableROSpecID(new Bit(0));
    reportContent.setEnableSpecIndex(new Bit(0));
    reportContent.setEnableTagSeenCount(new Bit(0)); // count is always 1, because the trigger is Upon_N_Tags_Or_End_Of_ROSpec with N=1 
    roReportSpec.setTagReportContentSelector(reportContent);
    roSpec.setROReportSpec(roReportSpec);
     
    return roSpec;
  }
   
  // Add the ROSpec to the reader.
  public void addROSpec()
  {
    ADD_ROSPEC_RESPONSE response;
     
    ROSpec roSpec = buildROSpec();
    //Util.log("Adding the ROSpec.");
    
    try {
      ADD_ROSPEC roSpecMsg = new ADD_ROSPEC();
      roSpecMsg.setROSpec(roSpec);
      response = (ADD_ROSPEC_RESPONSE)reader.transact(roSpecMsg, TIMEOUT_MS);
      //System.out.println(response.toXMLString());
       
      // Check if the we successfully added the ROSpec.
      StatusCode status = response.getLLRPStatus().getStatusCode();
      if (status.equals(new StatusCode("M_Success"))) {
        //Util.log("Successfully added ROSpec.");
      } else {
        Util.log("Reader " + readerIP + ": Error adding ROSpec.");
        System.exit(1);
      }
    } catch (Exception e) {
      Util.log("Reader " + readerIP + ": Error adding ROSpec.");
      e.printStackTrace();
    }
  }
   
  // Enable the ROSpec.
  public void enableROSpec()
  {
    @SuppressWarnings("unused")
    ENABLE_ROSPEC_RESPONSE response;
     
    //Util.log("Enabling the ROSpec.");
    ENABLE_ROSPEC enable = new ENABLE_ROSPEC();
    enable.setROSpecID(new UnsignedInteger(ROSPEC_ID));
    
    try {
      response = (ENABLE_ROSPEC_RESPONSE)reader.transact(enable, TIMEOUT_MS);
      //System.out.println(response.toXMLString());
    } catch (Exception e) {
      Util.log("Reader " + readerIP + ": Error enabling ROSpec.");
      e.printStackTrace();
    }
  }


  // Start the ROSpec.
  public void startROSpec()
  {
    @SuppressWarnings("unused")
    START_ROSPEC_RESPONSE response;
    //Util.log("Starting the ROSpec.");
    START_ROSPEC start = new START_ROSPEC();
    start.setROSpecID(new UnsignedInteger(ROSPEC_ID));
    try {
      response = (START_ROSPEC_RESPONSE)reader.transact(start, TIMEOUT_MS);

      //System.out.println(response.toXMLString());
    } catch (Exception e) {
      Util.log("Reader " + readerIP + ": Error deleting ROSpec.");
      e.printStackTrace();
    }
  }
   
  // Delete all ROSpecs from the reader.
  public void deleteROSpecs()
  {
    @SuppressWarnings("unused")
    DELETE_ROSPEC_RESPONSE response;
     
    //Util.log("Deleting all ROSpecs.");
    DELETE_ROSPEC del = new DELETE_ROSPEC();
    // Use zero as the ROSpec ID.
    // This means delete all ROSpecs.
    del.setROSpecID(new UnsignedInteger(0));
    try {
      response = (DELETE_ROSPEC_RESPONSE)reader.transact(del, TIMEOUT_MS);
      //System.out.println(response.toXMLString());
    } catch (Exception e) {
      Util.log("Reader " + readerIP + ": Error deleting ROSpec.");
      e.printStackTrace();
    }
  }

  private static Date lastTimestamp = null;

  // This function gets called asynchronously from an anonymous thread when a tag report is available.
  public void messageReceived(LLRPMessage message) {
  	//Util.log("Message received");
        
    try {
      if (message.getTypeNum() == RO_ACCESS_REPORT.TYPENUM) {
        // The message received is an Access Report.
        RO_ACCESS_REPORT report = (RO_ACCESS_REPORT) message;
   
        
        Date newTimestamp = new Date();
        if (lastTimestamp == null)
          lastTimestamp = newTimestamp; // for first event, set last timestamp equal to new timestamp
        
        long msDiff = newTimestamp.getTime() - lastTimestamp.getTime(); // time since last read event in milliseconds
        //Util.log(msDiff);
        if (msDiff > 1000)
          Util.log("!!!!!!!!!! Reader " + readerIP + ":  Long delay between reader events: " + msDiff + "!!!!!!!!!!");
        
        int logInterval = 60*1000; // log active connections every 60 seconds
        
        if (newTimestamp.getTime() / logInterval != lastTimestamp.getTime() / logInterval) {
          System.out.print(Util.getTimestamp() + ": Reader " + readerIP + ": Socket connections: " + EventEmitter.getNrOfEmitters() +
                          " queue sizes: " + Util.showList(EventEmitter.getQueueSizes()));
          for (int queueSize : EventEmitter.getQueueSizes())
            System.out.print(queueSize + "  ");
          System.out.println();
        }
        lastTimestamp = newTimestamp;

        
        // Get a list of the tags read.
        List<TagReportData>  tags = report.getTagReportDataList();
        
        for (TagReportData tag : tags) {
        	String epcVerbose = tag.getEPCParameter().toString();
          String firstSeenVerbose = tag.getFirstSeenTimestampUTC().toString();
          String lastSeenVerbose = tag.getLastSeenTimestampUTC().toString();
        	CharSequence epcStr = epcVerbose.subSequence(15, epcVerbose.length());
          CharSequence firstSeenStr = firstSeenVerbose.subSequence(37, firstSeenVerbose.length());
          CharSequence lastSeenStr = lastSeenVerbose.subSequence(36, lastSeenVerbose.length());
        	String json =
        	  "{\"readerIP\":\"" + readerIP + "\"" +
            ",\"ant\":" + tag.getAntennaID().getAntennaID().toString() +
            ",\"ePC\":\"" + epcStr + "\"" +
            ",\"RSSI\":" + tag.getPeakRSSI().getPeakRSSI().toString() +
            ",\"firstSeen\":\"" + firstSeenStr + "\"" +
            ",\"lastSeen\":\"" + lastSeenStr + "\"" +
            "}";
        	sendLine(json);
            //System.out.println(tag.getEPCParameter());
            //System.out.println(tag.getPeakRSSI());
            //System.out.println(tag.getLastSeenTimestampUTC());
        }
      } else if (message.getTypeNum() == READER_EVENT_NOTIFICATION.TYPENUM) {
        READER_EVENT_NOTIFICATION notification = (READER_EVENT_NOTIFICATION)message;
        ReaderEventNotificationData notificationData = notification.getReaderEventNotificationData();
        
        if (notificationData.getConnectionAttemptEvent() != null) {
          ConnectionAttemptEvent evt = notificationData.getConnectionAttemptEvent();
          //Util.log("Reader "+readerIP+": "+ evt.getStatus().intValue());
          switch (evt.getStatus().intValue()) {
          case ConnectionAttemptStatusType.Success:
            Util.log("Reader " + readerIP + ": Connection attempt successful");
            break;
          case ConnectionAttemptStatusType.Another_Connection_Attempted:
            Util.log("Reader " + readerIP + ": Retrying connection");
            break;
          case ConnectionAttemptStatusType.Failed_A_Client_Initiated_Connection_Already_Exists:
            Util.log("Reader " + readerIP + ": Connection failed, client-initiated connection already exists.");
            System.exit(1);
            break;
          case ConnectionAttemptStatusType.Failed_A_Reader_Initiated_Connection_Already_Exists:
            Util.log("Reader " + readerIP + ": Connection failed, reader-initiated connection already exists.");
            System.exit(1);
            break;
          case ConnectionAttemptStatusType.Failed_Reason_Other_Than_A_Connection_Already_Exists:
            Util.log("Reader " + readerIP + ": Connection failed, reason unknown. Message:");
            System.out.println(message.toXMLString());
            System.exit(1);
            break;          
          }    
        } else if (notificationData.getROSpecEvent() != null) {
          ROSpecEvent evt = notificationData.getROSpecEvent();
          switch (evt.getEventType().intValue()) {
          case ROSpecEventType.Start_Of_ROSpec:
            Util.log("Reader " + readerIP + ": ROSpec with id " + evt.getROSpecID() + " started.");
            break;
          case ROSpecEventType.End_Of_ROSpec:
            Util.log("Reader " + readerIP + ": ROSpec with id " + evt.getROSpecID() + " ended.");
            break;
          default:
            Util.log("Reader " + readerIP + ": Unhandled ROSpecEvent. Message:");
            System.out.println(message.toXMLString());
          }
        } else if (notificationData.getAISpecEvent() != null) {
          AISpecEvent evt = notificationData.getAISpecEvent();
          switch (evt.getEventType().intValue()) {
          case AISpecEventType.End_Of_AISpec:
            Util.log("Reader " + readerIP + ": AISpec ended.");
            break;
          default:
            Util.log("Reader " + readerIP + ": Unhandled AISpecEvent. Message:");
            System.out.println(message.toXMLString());
          }
        } else {
          Util.log("Reader " + readerIP + ": Unhandled reader event notification data in received message:");
          System.out.println(message.toXMLString());
        }
      } else {
        Util.log("Reader " + readerIP + ": Unhandled reader message received: "+message.getTypeNum());
        System.out.println(message.toXMLString());
      }
    }
    catch (Exception e) {
      Util.log("Error printing reader message");
      e.printStackTrace();
    }
  }
   
  // This function gets called asynchronously
  // when an error occurs.
  public void errorOccured(String s) {
    Util.log("Reader " + readerIP + ": An error occurred: " + s);
  }
   
  // Connect to the reader
  public void connect(String hostname){
    // Create the reader object.
    reader = new LLRPConnector(this, hostname);
    // Try connecting to the reader.
    try
    {
      Util.log("Connecting to reader at " + readerIP + ".");
      ((LLRPConnector) reader).connect();
    } catch (LLRPConnectionAttemptFailedException e) { // handled by messageReceived()
      //e.printStackTrace();
      //System.exit(1);
    }
  }
   
  // Disconnect from the reader
  public void disconnect() {
    ((LLRPConnector) reader).disconnect();
  }
   
  public void getReaderCapabilities() {
    GET_READER_CAPABILITIES_RESPONSE response;
     
    //Util.log("Deleting all ROSpecs.");
    GET_READER_CAPABILITIES cmd = new GET_READER_CAPABILITIES();
    // Use zero as the ROSpec ID.
    // This means delete all ROSpecs.
    cmd.setRequestedData(new GetReaderCapabilitiesRequestedData(GetReaderCapabilitiesRequestedData.All));
    try {
      response = (GET_READER_CAPABILITIES_RESPONSE)reader.transact(cmd, TIMEOUT_MS);
      System.out.println(response.toXMLString());
    }
    catch (Exception e) {
    	Util.log("Reader " + readerIP + ": Error getting reader capabilities.");
      e.printStackTrace();
    }
  }

  // Not in any of the code samples, but essential for the reader to start transmitting
  public void enableEventsAndReports() { 
  	ENABLE_EVENTS_AND_REPORTS cmd = new ENABLE_EVENTS_AND_REPORTS();
    try {
      reader.send(cmd);
      //Util.log("Enabled events and reports.");
    } catch (Exception e) {
    	Util.log("Reader " + readerIP + ": Error enabling events and reports.");
      e.printStackTrace();
    }
  }
  
  // Connect to the reader, setup the ROSpec
  // and run it.
  public void run() {
    Util.log("Initializing reader at " + readerIP + ".");
    connect(readerIP);
    //getReaderCapabilities();
    deleteROSpecs();
    addROSpec();
    enableROSpec();
    enableEventsAndReports();
    startROSpec();
    Util.log("Initialization for reader at " + readerIP + " completed.");
  }
   
  // Cleanup. Delete all ROSpecs
  // and disconnect from the reader.
  public void stop() {
    Util.log("Stopping reader at " + readerIP + ".");
    deleteROSpecs();
    disconnect();
  }
  
  private void sendLine(String message) {
    EventEmitter.queueEventOnAllEmitters(message);
  }
 
}