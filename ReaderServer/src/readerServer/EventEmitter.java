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

  private static final int eventBufferSize = 100;
  
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

  public static void queueEventOnAllEmitters(String event) {
    for (EventEmitter emitter : allEventEmitters) {
      emitter.queueEvent(event);
    }
  }
  

  // To be called from main thread
  public void queueEvent(String event) {
    synchronized (eventQueue) {
      if (eventQueue.size() > eventBufferSize) {
        int nrOfEventsToDrop = eventBufferSize/10;
        System.out.println("Buffer overflow for "+originatingIP+", dropping " + nrOfEventsToDrop + " events");
        List<String> droppedEvents = eventQueue.subList(0, nrOfEventsToDrop);
        eventQueue.removeAll(droppedEvents);
      }
      eventQueue.add(event);
      //System.out.println("Nr of events in queue for "+originatingIP+":"+eventQueue.size());
      eventQueue.notify();
   }
  }
  
  
  // TODO: synchronize adding removing of emitters to allEventEmitters
  // TODO: check if relying on eventQueue Vector sync is enough for emit loop
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
