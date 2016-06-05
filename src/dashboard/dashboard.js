import template from './dashboard.html';
import {NewTimezoneForm} from './new-timezone-form/new-timezone-form.js';
import {TimezoneCard} from './timezone-card/timezone-card.js';
import {StoreCurrentTime} from './store-current-time/store-current-time.js';
import {Element, exceptionMsg} from './element/element.js';
import doT from 'dot';
import moment from 'moment-timezone';

export {exceptionMsg};

/**
 * [elementsQuery Main DOM elemement used in Dashboard]
 * @type {Object}
 */
export const elementsQuery = {
  mainTzContainer: '#main-timezones-container',
  addTzContainer: '#add-timezone-container',
  additionalTzContainer: '#additional-timezones-container'
};

/**
 * Dashboard initialize main part of application
 * like a "main timezones", "new timezone form" and so on
 */
export class Dashboard extends Element {
  /**
   * It will create whole element and append it to targetEl
   * passsed in config
   * @param  {Object} config contains only targetEl
   */
  constructor(config = {}) {
    super(config, elementsQuery);
    this.timezones = [];
  }

  render() {
    super.render();
    this.config.targetEl.innerHTML = doT.template(template)();
  }

  /**
   * After render Element create Store data
   * for a used current time and another elements
   */
  post() {
    super.post();
    this.storeCurrentTime = new StoreCurrentTime();
    this.addElements();
  }

  addElements() {
    this.addNewTimezoneForm();
    this.initMainTimezones();
  }

  /**
   * Creating new timezone form
   */
  addNewTimezoneForm() {
    new NewTimezoneForm({
      targetEl: this.domEl.addTzContainer,
      onAddTimezone: this.addNewTimeZone.bind(this)
    });
  }

  /**
   * Creating main timezones card
   */
  initMainTimezones() {
    new TimezoneCard({
      targetEl: this.domEl.mainTzContainer,
      cssClass: 'col-xs-12 col-md-6',
      time: this.storeCurrentTime.value,
      timezone: moment.tz.guess(),
      storeCurrentTime: this.storeCurrentTime
    });
    new TimezoneCard({
      targetEl: this.domEl.mainTzContainer,
      cssClass: 'col-xs-12 col-md-6',
      time: this.storeCurrentTime.value,
      timezone: 'GMT',
      storeCurrentTime: this.storeCurrentTime
    });
  }

  /**
   * Callback function for a "new timezone form"
   */
  addNewTimeZone(value) {
    new TimezoneCard({
      targetEl: this.domEl.additionalTzContainer,
      time: this.storeCurrentTime.value,
      timezone: value,
      storeCurrentTime: this.storeCurrentTime
    });
  }
}
