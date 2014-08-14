package readerServer;

import java.io.DataOutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Timer;
import java.util.TimerTask;
import java.util.Vector;

/**
 * Basic server that connects to RFID reader and redirects all read events to a socket. 
 * 
 * @author Martijn Schrage - Oblomov Systems
 * 
 */
public class Main {
  /* Motorola FX9500 Reader IP assignments in Rotterdam:
   * Mac: C4:7D:CC:06:DC:EE  IP: 10.0.0.30
   * Mac: C4:7D:CC:06:BA:05  IP: 10.0.0.31 A
   * Mac: C4:7D:CC:06:BF:EB  IP: 10.0.0.32
   * Mac: 00:23:68:F1:54:C2  IP: 10.0.0.33 (Currently in Groningen)
   * */
  private static final String readerIPs[] = {"10.0.0.30","10.0.0.31","10.0.0.32"};
  private static final int readerServerPort = 8193;

  private static final int CONNECTION_LOG_INTERVAL_MS = 60 * 1000; // Interval for logging reader connection status
  private static final int MONITOR_INTERVAL_MS = 1000; // Interval for checking reader keepalive age (should be larger than LLRPClient.KEEPALIVE_INTERVAL_MS)
  
  private static Vector<LLRPClient> llrpClients = new Vector<LLRPClient>();
 
  // TODO: maybe we don't want to shut down the entire server if one reader fails.
  
  public static void main(String[] args)
  {
    Runtime.getRuntime().addShutdownHook(new Thread() {
      public void run() {
        Util.log("Shutdown signal received, stopping readers.");
        for (LLRPClient llrpClient : llrpClients) {
          if (llrpClient != null) {
            llrpClient.stop();
          }
        }
        Util.log("Exiting reader server.");
      }
    });
    
    startServer(readerServerPort);
    //test();
  }

  @SuppressWarnings("resource")
  private static void startServer(int port) {
	  ServerSocket serversocket = null;
	  System.out.println("\n\n###########################################\n");
	  Util.log("Starting Reader Server\n");
	  
	  try {
      Util.log("Setting up server socket on port " + port);
      serversocket = new ServerSocket(port);
    } catch (Exception e) {
	    System.err.println("Error:" + e.getMessage());
	    return;
	  }
	  Util.log("Initializing "+readerIPs.length + " reader" + (readerIPs.length>1 ? "s" : "") +
	           " at IP adress" + (readerIPs.length>1 ? "es" : "") + ": ");
	  Util.log(Util.showList(readerIPs));
	  for (String readerIP : readerIPs) {
	    LLRPClient llrpClient = new LLRPClient(readerIP);
	    llrpClient.run();
	    llrpClients.add(llrpClient);
	  }
    Util.log("All readers initialized");
    logReaderConnections();
    monitorReaders();
    
    while (true) {
      Util.log("Waiting for client connection on " + port);
      
      try {
        Socket connectionsocket = serversocket.accept();
        InetAddress clientIP = connectionsocket.getInetAddress();
        System.out.println();
        Util.log("Connected to " + clientIP);     
        
        DataOutputStream output =
          new DataOutputStream(connectionsocket.getOutputStream());

        new EventEmitter(clientIP.toString(), output);
        // This creates a new event emitter which starts a new thread and adds itself to the EventEmitter.allEventEmitters list
        Util.log("Socket connections: " + EventEmitter.getNrOfEmitters());
      }
      catch (Exception e) {
        Util.log("Error in main loop:\n" + e.getMessage());
        System.exit(1);
      }
    }
	}
  
  @SuppressWarnings("unused")
  private static void test() {
    new EventEmitter("1", null);
    new EventEmitter("2", null);
    System.out.println("Main waiting for synchronized");
    
    EventEmitter.queueEventOnAllEmitters("event 1");

    try {
      System.out.println("Main sleeping");
      Thread.sleep(1000);
      System.out.println("Main woke up");
    } catch (InterruptedException e) {
      // TODO Auto-generated catch block
      e.printStackTrace();
    }
    while (true) {
      EventEmitter.queueEventOnAllEmitters("event 2");
      EventEmitter.queueEventOnAllEmitters("event 3");
      try {
        Thread.sleep(1);
      } catch (InterruptedException e) {
        e.printStackTrace();
      }
    }
  }
  
  private static void logReaderConnections() {
    Timer uploadCheckerTimer = new Timer(true);
    uploadCheckerTimer.scheduleAtFixedRate(
        new TimerTask() {
          public void run() { 
            for (LLRPClient client : llrpClients) {
              client.logConnectionReport();              
            }
          }
        }, 0, CONNECTION_LOG_INTERVAL_MS);
  }
  
  // Exit reader server when for any of the readers, the keepalive event has not been received since last check.
  private static void monitorReaders() {
    Timer uploadCheckerTimer = new Timer(true);
    uploadCheckerTimer.scheduleAtFixedRate(
        new TimerTask() {
          public void run() { 
            for (LLRPClient client : llrpClients) {
              long timeSinceKeepalive = client.getTimeSinceKeepalive();
              //Util.log(client.readerIP + " " + timeSinceKeepalive);
              
              if (timeSinceKeepalive > MONITOR_INTERVAL_MS) { 
                Util.log("Reader " + client.readerIP + ": No keepalive since previous monitor check.");
                System.exit(1);
              }              
            }
          }
        }, 0, MONITOR_INTERVAL_MS);
  }
}
