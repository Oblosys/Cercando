package readerServer;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStreamReader;
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
  
  public static void main(String[] args)
  {
    startServer(readerServerPort);
  }

  @SuppressWarnings("resource")
  public static void startServer(int port) {
	  ServerSocket serversocket = null;

	  try {
      System.out.println("Setting up server socket on port " + port);
      serversocket = new ServerSocket(port);
    } catch (Exception e) {
	    System.err.println("Error:" + e.getMessage());
	    return;
	  }
	  
    while (true) {
      System.out.println("\nWaiting for client connection on " + port);
      
      try {
        Socket connectionsocket = serversocket.accept();
        InetAddress client = connectionsocket.getInetAddress();
        System.out.println("Connected to " + client);

        BufferedReader input =
          new BufferedReader(new InputStreamReader(connectionsocket.getInputStream()));

        DataOutputStream output =
          new DataOutputStream(connectionsocket.getOutputStream());

        serveLLRPEvents(input, output);
      }
      catch (Exception e) {
        System.out.println("\nError:" + e.getMessage());
      }
    }
	}

  private static void serveLLRPEvents(BufferedReader input, DataOutputStream output) {
    LLRPClient llrpClient = new LLRPClient(output);
  
    System.out.println("Starting reader at "+readerIP+".");
    llrpClient.run(readerIP);
    
    try { // Keep sending events until newline from client (or broken socket) 
  	  input.readLine();
    } catch (Exception e) {
        System.out.println("Error while waiting for newline on client socket:");
        e.printStackTrace();
    }   
    System.out.println("Stopping reader.");
    llrpClient.stop();
  }
}


