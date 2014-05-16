package readerServer;

import java.io.DataOutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * Basic server that connects to RFID reader and redirects all read events to a socket. 
 * 
 * @author Martijn Schrage - Oblomov Systems
 * 
 */
public class Main {
  
  private static final String readerIP = "10.0.0.30";
  private static final int readerServerPort = 8193;
  
  private static LLRPClient llrpClient = new LLRPClient();
 
  public static void main(String[] args)
  {
    Runtime.getRuntime().addShutdownHook(new Thread() {
      public void run() {
        Util.log("Shutdown signal received, stopping reader.");
        if (llrpClient != null) {
          llrpClient.stop();
        }
        System.out.println("Exiting reader server.");
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
      System.out.println("Setting up server socket on port " + port);
      serversocket = new ServerSocket(port);
    } catch (Exception e) {
	    System.err.println("Error:" + e.getMessage());
	    return;
	  }
	  
    System.out.println("Starting reader at "+readerIP+".");
    llrpClient.run(readerIP);

    
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
        System.out.println("\nError in main loop:\n" + e.getMessage());
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
}
