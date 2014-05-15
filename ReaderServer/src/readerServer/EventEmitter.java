package readerServer;

import java.io.DataOutputStream;
import java.util.List;
import java.util.Vector;

/**
 *
 * 
 * @author Martijn Schrage - Oblomov Systems
 * 
 */

public class EventEmitter implements Runnable {

  private static final int eventBufferSize = 10000;
  
  private static Vector<EventEmitter> allEventEmitters = new Vector<EventEmitter>();
  
  private String originatingIP;
  private Vector<String> eventQueue;
  private DataOutputStream socketOut;
  
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
  

  // To be called from main thread
  public void queueEvent(String event) {
    // When communication is blocked, first the socket buffer will be filled, which is not noticable by this code.
    // Once the socket buffer is full, further socket write commands will block, and the corresponding event emitter
    // will cease to consume its eventQueue. The queue will grow to the maximum size, after which events will be dropped.
    synchronized (eventQueue) {
      if (eventQueue.size() > eventBufferSize) {
        int nrOfEventsToDrop = eventBufferSize/10;
        System.out.println("Buffer overflow for "+originatingIP+", dropping " + nrOfEventsToDrop + " events");
        // not the most efficient way, but this will not happen often anyway
        for (int i=0; i<nrOfEventsToDrop; i++)
          eventQueue.remove(0);
      }
      eventQueue.add(event);
      //System.out.println("Nr of events in queue for "+originatingIP+":"+eventQueue.size());
      eventQueue.notify();
   }
  }
  
  
  // TODO: synchronize adding removing of emitters to allEventEmitters
  // TODO: check if relying on eventQueue Vector sync is enough for emit loop
  //       (it probably is, since we only add at the end, and removal is done in this thread only)
  @Override
  public void run() {
    while (true) {
      try {
        //System.out.println(originatingIP + " about enter sync");
        synchronized (eventQueue) {
          //System.out.println(originatingIP + " about to wait");
          eventQueue.wait();
          //System.out.println(originatingIP + " woke up");
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
      } catch (Exception e) {
        if (e.getMessage().equals("Broken pipe")) 
          System.out.println(Util.getTimestamp() + ": Client socket closed.");
        else
          System.out.println(Util.getTimestamp() + ": Error while writing to socket: "+e.getMessage());
        allEventEmitters.remove(this);
        //e.printStackTrace();
      }   
    }
  }
}
