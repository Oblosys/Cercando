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
  static String getTimestamp() {
    DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    return dateFormat.format(new Date());
  }
}
