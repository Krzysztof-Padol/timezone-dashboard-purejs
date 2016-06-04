import template from './new-timezone-form.html';
import moment from 'moment-timezone';
import {Element, exceptionMsg} from './../element/element.js';
import doT from 'dot';

export {exceptionMsg};

export const elementsQuery = {
  submitButton: 'button[type="submit"]',
  selectList: '#ddTimezone'
};

export class NewTimezoneForm extends Element {
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
}
