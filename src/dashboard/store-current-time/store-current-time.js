import {Observer} from './../observer/observer.js';
import moment from 'moment-timezone';

class StoreCurrentTime extends Observer {
  constructor() {
    super();
    this.value = moment();
  }

  update(newTime) {
    this.value = newTime;
    this.fire(this.value);
  }
}

export {StoreCurrentTime};
