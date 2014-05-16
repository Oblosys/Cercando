package readerServer;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Utility methods 
 * 
 * @author Martijn Schrage - Oblomov Systems
 * 
 */
public class Util {
  static <T> String showList(T[] c) {
    String res = "[";
    String separator = "";
    for (T x : c) {
      res += separator + x.toString();
      separator = ", ";
    }
    return res + "]";
  }
  
  static String getTimestamp() {
    return formatTimestamp(new Date());
  }
  
  static String formatTimestamp(Date date) {
    DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    return dateFormat.format(date);
  }
  
  static void log(String msg) {
    System.out.println(Util.getTimestamp() + ": " + msg);
  }
}
