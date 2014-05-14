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
        System.out.println(Util.getTimestamp() + ": Shutdown signal received, stopping reader.");
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
	  System.out.println(Util.getTimestamp() + ": Starting Reader Server\n");
	  
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
      System.out.println("\n" + Util.getTimestamp() + ": Waiting for client connection on " + port);
      
      try {
        Socket connectionsocket = serversocket.accept();
        InetAddress clientIP = connectionsocket.getInetAddress();
        System.out.println("\n" + Util.getTimestamp() + ": Connected to " + clientIP);

        
        DataOutputStream output =
          new DataOutputStream(connectionsocket.getOutputStream());

        new EventEmitter(clientIP.toString(), output);
        //System.out.println(getTimestamp() + " Disconnected");
      }
      catch (Exception e) {
        System.out.println("\nError in main loop:\n" + e.getMessage());
        System.exit(1);
      }
    }
	}
  
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
