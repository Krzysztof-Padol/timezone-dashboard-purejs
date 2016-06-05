import {Observer} from './../observer/observer.js';
import moment from 'moment-timezone';

/**
 * Class store data for a current used time by
 * a user. That class extends observer class which
 * give us possibility to register element on changes
 * in this object
 */
class StoreCurrentTime extends Observer {
  constructor() {
    super();
    this.value = moment();
  }

  update(newTime) {
    this.value = newTime;
    // Emit changes
    this.fire(this.value);
  }
}

export {StoreCurrentTime};
