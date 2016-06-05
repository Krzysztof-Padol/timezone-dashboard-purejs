import template from './timezone-card.html';
import moment from 'moment-timezone';
import {StoreCurrentTime} from './../store-current-time/store-current-time.js'
import {Element, exceptionMsg} from './../element/element.js';
import doT from 'dot';

const exceptionMsgInternal = Object.assign({}, exceptionMsg, {
  noStoreCurrentTime: 'Please pass store current time in config',
  wrongInstance: 'Store current time property should be instance of StoreCurrentTime',
  noTime: 'Please pass time value',
  noTimeZone: 'Please pass timezone'
});

export {exceptionMsgInternal as exceptionMsg};

export const elementsQuery = {
  timeContainer: '.time-container',
  deleteIcon: '.delete',
  dateInput: 'input[type="date"]',
  timeInput: 'input[type="time"]',
  changeButton: 'button[type="submit"]',
};

export class TimezoneCard extends Element {
  constructor(config = {}) {
    super(config, elementsQuery);
    this.storeCurrentTime = config.storeCurrentTime;
  }

  checkConfig() {
    super.checkConfig();
    if (!this.config.storeCurrentTime) {
      throw new Error(exceptionMsgInternal.noStoreCurrentTime);
    } else if (!(this.config.storeCurrentTime instanceof StoreCurrentTime)) {
      throw new Error(exceptionMsgInternal.wrongInstance);
    } else if (!this.config.time) {
      throw new Error(exceptionMsgInternal.noTime);
    } else if (!this.config.timezone) {
      throw new Error(exceptionMsgInternal.noTimeZone);
    }
  }

  render() {
    let tempFn = doT.template(template);
    let div = document.createElement("div");

    div.innerHTML = tempFn({
      time: this.config.time.clone().tz(this.config.timezone).format('lll'),
      dateFormat: this.config.time.clone().tz(this.config.timezone).format('YYYY-MM-DD'),
      timeFormat: this.config.time.clone().tz(this.config.timezone).format('hh:mm'),
      timezone: this.config.timezone
    }); 

    this.config.targetEl.appendChild(div);
  }
}
