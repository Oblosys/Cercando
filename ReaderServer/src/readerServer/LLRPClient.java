package readerServer;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

import org.apache.mina.common.IoSession;
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
  private LLRPConnector reader;
  private static final int TIMEOUT_MS = 10000;
  private static final int ROSPEC_ID = 1;
  private static final int KEEPALIVE_INTERVAL_MS = 500; // Interval for keepalive events, should be smaller than Main.MONITOR_INTERVAL_MS
  public final String readerIP;

  private Date lastKeepAliveTimestamp = null;
  private long nrOfReadEvents = 0;
  private long nrOfReadEventsSinceLastReport = 0;

  public LLRPClient(String readerIP) {
    this.readerIP = readerIP;
  }
  
  // Return the nr of milliseconds since we last received a keepalive from the reader, or -1 if no keepalive was received yet.
  public long getTimeSinceKeepalive() {
    return (lastKeepAliveTimestamp != null) ? (new Date().getTime() - lastKeepAliveTimestamp.getTime()) : -1;
  }
  
  public void logConnectionReport() {
    Util.log("Reader " + readerIP + ": Nr of events: " + nrOfReadEventsSinceLastReport + 
             " (total: "+nrOfReadEvents+")");
    nrOfReadEventsSinceLastReport = 0;
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
                                             // NOTE: also need to keep this 1 to prevent batch processing that 
                                             //       would require firstSeen and lastSeen info (see comment in messageReceived(), below)
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

  // This function gets called asynchronously from an anonymous thread when a tag report is available.
  public void messageReceived(LLRPMessage message) {
  	//Util.log("Message received");
        
    try {
      if (message.getTypeNum() == RO_ACCESS_REPORT.TYPENUM) {
        // The message received is an Access Report.
        RO_ACCESS_REPORT report = (RO_ACCESS_REPORT) message;
   
        nrOfReadEvents++;
        nrOfReadEventsSinceLastReport++;
            
        Date timestamp = new Date();

        // Get a list of the tags read.
        List<TagReportData>  tags = report.getTagReportDataList();
        
        for (TagReportData tag : tags) {
        	String epcVerbose = tag.getEPCParameter().toString();
          //String firstSeenVerbose = tag.getFirstSeenTimestampUTC().toString();
          //String lastSeenVerbose = tag.getLastSeenTimestampUTC().toString();
          
        	// Because tags can have different formats with different prefixes, we take the sequence
        	// of alphanumeric characters ending at the right.
        	StringBuilder epcBuilder = new StringBuilder();
          for (int i=epcVerbose.length()-1; i>=0; i--) {
            char c = epcVerbose.charAt(i);
            if (!Character.isLetterOrDigit(c))
              break;
            epcBuilder.append(c);
          }
          String epcStr = epcBuilder.reverse().toString();
          if (epcStr.isEmpty())
            epcStr = "INVALIDEPC"; // Prevent empty strings with an easy to recognize epc
          
          //CharSequence firstSeenStr = firstSeenVerbose.subSequence(37, firstSeenVerbose.length());
          //CharSequence lastSeenStr = lastSeenVerbose.subSequence(36, lastSeenVerbose.length());
          
          // Instead of firstSeen and lastSeen, we simply send a single reader-server timestamp.
          // The reason is that the readers cannot sync their clocks with a time server, and programmatically
          // setting the clock is not possible with LLRP (or not documented at least). Reader-server time will be
          // good enough as long as the network lag between the reader and the server is low.
          // NOTE: In order for the reader-server timestamp to work, we need to prevent batch processing by keeping
          // Upon_N_Tags_Or_End_Of_ROSpec = 1 in the ROSpec.
          
          DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss:SSS");

        	String json =
        	  "{\"readerIp\":\"" + readerIP + "\"" +
            ",\"ant\":" + tag.getAntennaID().getAntennaID().toString() +
            ",\"epc\":\"" + epcStr + "\"" +
            ",\"rssi\":" + tag.getPeakRSSI().getPeakRSSI().toString() +
            ",\"timestamp\":\"" + dateFormat.format(timestamp) + "\"" +
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
      } else if (message.getTypeNum() == KEEPALIVE.TYPENUM) {
        //Util.log("Reader " + readerIP + ": KeepAlive received");
        lastKeepAliveTimestamp = new Date();
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
    Util.log("Reader " + readerIP + ": An unhandled error occurred: " + s);
    Util.log("Terminating reader server.\n\n");
    System.exit(1); // Sometimes LLRP yields java.io.IOExceptions, after which readers don't communicate anymore. Until we've found the cause,
    // simply exit the reader server, which causes all reader connections to be closed, and triggers a respawn of the reader server process.
  }
   
  // Connect to the reader
  public void connect(String hostname){
    // Create the reader object.
    reader = new LLRPConnector(this, hostname);
    
    // Extra debug code to try and fix lost connections
    LLRPIoHandlerAdapter handler = new LLRPIoHandlerAdapterImpl(reader){
      @Override
      public void sessionOpened(IoSession session) throws Exception { // For some reason, this is also called when stopping the readers..
        Util.log("Session opened"); // we can store the session to check connection on the LLRPClient object 
        super.sessionOpened(session);
      }
      
      @Override
      public void exceptionCaught(IoSession session, Throwable cause) throws Exception {
        Util.log("Exception was caught (should be sent to errorOccured)");
        super.exceptionCaught(session, cause);
      }
    };
    reader.setHandler(handler);
    // end of debug code
    
    // Try connecting to the reader.
    try
    {
      Util.log("Connecting to reader at " + readerIP + ".");
      reader.connect();
      //Util.log("Ack " + reader.getHandler().isKeepAliveAck() + " Forward: " + reader.getHandler().isKeepAliveForward());
      // isKeepAliveAck is already set to true by default
      reader.getHandler().setKeepAliveForward(true);
    } catch (LLRPConnectionAttemptFailedException e) { // handled by messageReceived()
      //e.printStackTrace();
      //System.exit(1);
    }
  }
   
  // Disconnect from the reader
  public void disconnect() {
    ((LLRPConnector) reader).disconnect();
  }
   
  public GET_READER_CAPABILITIES_RESPONSE getReaderCapabilities() {
    GET_READER_CAPABILITIES_RESPONSE response;
     
    GET_READER_CAPABILITIES cmd = new GET_READER_CAPABILITIES();

    cmd.setRequestedData(new GetReaderCapabilitiesRequestedData(GetReaderCapabilitiesRequestedData.All));
    try {
      response = (GET_READER_CAPABILITIES_RESPONSE)reader.transact(cmd, TIMEOUT_MS);
      Util.log("Reader " + readerIP + ": Country code:   " + response.getRegulatoryCapabilities().getCountryCode());
      Util.log("Reader " + readerIP + ": Comm. standard: " + response.getRegulatoryCapabilities().getCommunicationsStandard());
      //System.out.println(response.toXMLString());
      return response;
    }
    catch (Exception e) {
    	Util.log("Reader " + readerIP + ": Error getting reader capabilities.");
      e.printStackTrace();
      return null;
    }
  }

  public GET_READER_CONFIG_RESPONSE getReaderConfig() {
    GET_READER_CONFIG_RESPONSE response;
     
    GET_READER_CONFIG cmd = new GET_READER_CONFIG();
    cmd.setRequestedData(new GetReaderConfigRequestedData(GetReaderConfigRequestedData.All));
    
    // Need to request config for all antennas and ports, otherwise command will time out.
    // See https://support.impinj.com/hc/communities/public/questions/201883788-Getting-Reader-Configuration-with-Java
    cmd.setAntennaID(new UnsignedShort(0));
    cmd.setGPIPortNum(new UnsignedShort(0));
    cmd.setGPOPortNum(new UnsignedShort(0));
    try {
      response = (GET_READER_CONFIG_RESPONSE)reader.transact(cmd, TIMEOUT_MS);
      System.out.println(response.toXMLString());
      return response;
    }
    catch (Exception e) {
      Util.log("Reader " + readerIP + ": Error getting reader configuration.");
      e.printStackTrace();
      return null;
    }
  }
  
  public void setReaderConfig() {
    //SET_READER_CONFIG_RESPONSE response;
     
    SET_READER_CONFIG cmd = new SET_READER_CONFIG();
    
    KeepaliveSpec keepaliveSpec = new KeepaliveSpec();
    keepaliveSpec.setKeepaliveTriggerType(new KeepaliveTriggerType(KeepaliveTriggerType.Periodic));
    keepaliveSpec.setPeriodicTriggerValue(new UnsignedInteger(KEEPALIVE_INTERVAL_MS));
    cmd.setKeepaliveSpec(keepaliveSpec);
    cmd.setResetToFactoryDefault(new Bit(0)); // Another undocumented magic parameter without which the command times out..
    try {
      /*response = (SET_READER_CONFIG_RESPONSE)*/reader.transact(cmd, TIMEOUT_MS);
      //System.out.println(response.toXMLString());
      // TODO: check status of response
    }
    catch (Exception e) {
      Util.log("Reader " + readerIP + ": Error setting reader configuration.");
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
    getReaderCapabilities();
    //getReaderConfig();
    setReaderConfig();
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