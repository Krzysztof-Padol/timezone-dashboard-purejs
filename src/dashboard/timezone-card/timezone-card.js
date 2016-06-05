import template from './timezone-card.html';
import moment from 'moment-timezone';
import {StoreCurrentTime} from './../store-current-time/store-current-time.js';
import {Element, exceptionMsg} from './../element/element.js';
import doT from 'dot';

/**
 * Error messages used in element
 * @type {[type]}
 */
const exceptionMsgInternal = Object.assign({}, exceptionMsg, {
  noStoreCurrentTime: 'Please pass store current time in config',
  wrongInstance: 'Store current time property should be instance of StoreCurrentTime',
  noTime: 'Please pass time value',
  noTimeZone: 'Please pass timezone'
});

const defaultCssClass = 'col-xs-12 col-sm-6 col-md-3 col-lg-2';

export {exceptionMsgInternal as exceptionMsg};

/**
 * [elementsQuery Main DOM elemement used in Dashboard]
 * @type {Object}
 */
export const elementsQuery = {
  flipContainer: '.timezone-card__flip-container',
  timeContainer: '.timezone-card__time-container',
  deleteIcon: '.timezone-card__delete',
  backButton: '.timezone-card__backButton',
  dateInput: 'input[type="date"]',
  timeInput: 'input[type="time"]',
  changeButton: 'button[type="submit"]'
};

export class TimezoneCard extends Element {
  /**
   * It will create whole element and append it to targetEl
   * passsed in config
   * @param  {Object} config contains:
   *                         targetEl,
   *                         time,
   *                         timezone,
   *                         storeCurrentTime (instance of StoreCurrentTime)
   */
  constructor(config = {}) {
    super(config, elementsQuery);
  }

  /**
   * Extend default checking config
   */
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
    let div = document.createElement('div');
    let targetEl = this.config.targetEl;

    div.innerHTML = tempFn({
      time: this.config.time.clone().tz(this.config.timezone).format('lll'),
      dateFormat: this.config.time.clone().tz(this.config.timezone).format('YYYY-MM-DD'),
      timeFormat: this.config.time.clone().tz(this.config.timezone).format('hh:mm'),
      timezone: this.config.timezone,
      cssClass: this.config.cssClass || defaultCssClass
    });

    this.config.targetEl = div;
    targetEl.appendChild(div);
  }

  post() {
    super.post();
    this.storeCurrentTime = this.config.storeCurrentTime;
    this.onCurrentTimeChange = this.onNewTime.bind(this);
    this.storeCurrentTime.register(this.onCurrentTimeChange);
  }

  addListeners() {
    this.addSmartListeners('deleteIcon', 'click', this.removeElement.bind(this));
    this.addSmartListeners('changeButton', 'click', () => {
      let newDateTime = [
        this.domEl.dateInput.value,
        this.domEl.timeInput.value
      ].join(' ');
      let newDateTimeMoment = moment.tz(newDateTime, this.config.timezone);

      this.storeCurrentTime.update(newDateTimeMoment);
    });
    this.addSmartListeners('flipContainer', 'click', (e) => {
      if (e.target.className === 'timezone-card__front'
       || e.target.className === 'timezone-card__back') {
        this.domEl.flipContainer.classList.toggle('timezone-card--flipped');
      }
    });
    this.addSmartListeners('backButton', 'click', () => {
      this.domEl.flipContainer.classList.toggle('timezone-card--flipped');
    });
  }

  removeElement() {
    super.removeElement();
    this.storeCurrentTime.unregister(this.onCurrentTimeChange);
  }

  /**
   * Callback function register by this object in
   * storeCurrentTime and it is ivoked on each change
   * @param  {[type]} newMomentTime [description]
   * @return {[type]}               [description]
   */
  onNewTime(newMomentTime) {
    this.updateTime(newMomentTime);
  }

  updateTime(time) {
    this.config.time = time.clone().tz(this.config.timezone).format('lll');
    this.domEl.timeContainer.innerHTML = this.config.time;
  }
}
