import template from './new-timezone-form.html';
import moment from 'moment-timezone';
import {Element, exceptionMsg} from './../element/element.js';
import doT from 'dot';

export {exceptionMsg};

/**
 * [elementsQuery Main DOM elemement used in Dashboard]
 * @type {Object}
 */
export const elementsQuery = {
  submitButton: 'button[type="submit"]',
  selectList: '#ddTimezone'
};

export class NewTimezoneForm extends Element {
  /**
   * It will create whole element and append it to targetEl
   * passsed in config
   * @param  {Object} config contains targetEl and onAddTimezone
   *                         callback function
   */
  constructor(config = {}) {
    super(config, elementsQuery);
    this.timezones = [];
  }

  preRender() {
    this.prepareTimeZoneList();
  }

  render() {
    let tempFn = doT.template(template);

    this.config.targetEl.innerHTML = tempFn({
      timezones: this.timezones
    });
  }

  prepareTimeZoneList() {
    this.timezones = moment.tz.names();
  }

  addListeners() {
    this.addSmartListeners('submitButton', 'click', this.addTimezone.bind(this));
  }

  addTimezone() {
    let selectedIndex = this.domEl.selectList.selectedIndex;
    let currentValue = this.domEl.selectList.options[selectedIndex].value;

    if (this.config.onAddTimezone) {
      this.config.onAddTimezone(currentValue);
    }
  }
}
