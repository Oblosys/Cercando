package readerServer;

import java.io.DataOutputStream;
import java.util.Vector;

/**
 * EventEmitter creates a consumer thread that continuously sends queued event to its socket output stream.
 * New EventEmitters are added to allEventEmitters list on creation, and removed from this list when they disconnect.
 * 
 * @author Martijn Schrage - Oblomov Systems
 * 
 */

public class EventEmitter implements Runnable {

  private static final int eventBufferSize = 100000;
  // Stores about 8 to 9 minutes worth of events in case of 1 reader, and
  // takes about 60Mb per stalled connection (2 connections are typically the maximum)
  
  
  private static Vector<EventEmitter> allEventEmitters = new Vector<EventEmitter>();
  
  private String originatingIP;
  private Vector<String> eventQueue;
  private DataOutputStream socketOut;
  
  // Initialize event emitter, add it to the allEventEmitters list and start a new thread.
  public EventEmitter(String originatingIP, DataOutputStream socketOut) {
    this.originatingIP = originatingIP;
    this.eventQueue = new Vector<String>();
    this.socketOut = socketOut;
    
    allEventEmitters.add(this);
    
    Thread thread = new Thread(this, "EventEmitter "+originatingIP);
    thread.start();
  }

  public static int getNrOfEmitters() {
    return allEventEmitters.size();
  }

  public static int[] getQueueSizes() {
    int queueSizes[] = new int[allEventEmitters.size()];
    
    synchronized (allEventEmitters) {
      for (int i=0; i<allEventEmitters.size(); i++) {
        queueSizes[i] = allEventEmitters.get(i).eventQueue.size();
      }
    }
    return queueSizes;
  }

  public static void queueEventOnAllEmitters(String event) {
    for (EventEmitter emitter : allEventEmitters) {
      emitter.queueEvent(event);
    }
  }

  // To be called from any thread except the one started by this event emitter.
  // Queue event for all event emitters, dropping the oldest events if necessary.
  public void queueEvent(String event) {
    // When communication is blocked, first the socket buffer will be filled, which is not noticable by this code.
    // Once the socket buffer is full, further socket write commands will block, and the corresponding event emitter
    // will cease to consume its eventQueue. The queue will grow to the maximum size, after which events will be dropped.
    synchronized (eventQueue) {
      if (eventQueue.size() > eventBufferSize) {
        int nrOfEventsToDrop = eventBufferSize/10;
        System.out.println("Buffer overflow for "+originatingIP+", dropping " + nrOfEventsToDrop + " events");
        // Not the most efficient way, but this will not happen often anyway
        for (int i=0; i<nrOfEventsToDrop; i++)
          eventQueue.remove(0);
      }
      eventQueue.add(event);
      eventQueue.notify(); // Signal the consumer thread for this event emitter.
   }
  }
  
  @Override
  // Consume events from the queue and send them to the socket, and on an exception remove this emitter
  // from allEventEmitters list.
  public void run() {
    while (true) { 
      try {        
        synchronized (eventQueue) {
          eventQueue.wait(); // Block here until events are queued
        }
        while (!eventQueue.isEmpty()) {
          String event = eventQueue.elementAt(0);
          eventQueue.remove(0);
          socketOut.writeUTF(event);
          //System.out.println("Sending "+event+" to "+originatingIP + " remaining: "+eventQueue.size());
        }
      } catch (InterruptedException e) {
        System.out.println("EventEmitter for "+originatingIP+" received InterruptedException");
        allEventEmitters.remove(this);
        Util.log("Socket connections: " + EventEmitter.getNrOfEmitters());
      } catch (Exception e) {
        if (e.getMessage().equals("Broken pipe")) { // Stopping the Lucy server breaks the socket, so this is the normal way to disconnect
          System.out.println();
          Util.log("Disconnected from " + originatingIP);     
        } else { // Any other exceptions are worth logging.
          Util.log("Error while writing to socket: "+e.getMessage());
        }
        allEventEmitters.remove(this);
        Util.log("socket connections: " + EventEmitter.getNrOfEmitters());
        //e.printStackTrace();
      }   
    }
  }
}
