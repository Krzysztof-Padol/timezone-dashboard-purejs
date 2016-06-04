import template from './new-timezone-form.html';
import moment from 'moment-timezone';
import doT from 'dot';

export const exceptionMsg = {
  noTargetEl: 'You should pass targetEl (DOM element) in config',
  noDomTargetEl: 'You should DOM element as a targetEl in config'
};

export const elementsQuery = {
  submitButton: 'button[type="submit"]',
  selectList: '#ddTimezone'
};

export class NewTimezoneForm {
  constructor(config = {}) {
    this.config = config;
    this.checkConfig();
    this.timezones = [];
    this.domEl = {};

    this.prepareTimeZoneList();
    this.render();
    this.assignDomElements();
  }

  checkConfig() {
    if (!this.config.targetEl) {
      throw new Error(exceptionMsg.noTargetEl);
    } else if (this.config.targetEl && !this.config.targetEl.tagName) {
      throw new Error(exceptionMsg.noDomTargetEl);
    }
  }

  render() {
    let tempFn = doT.template(template);

    this.config.targetEl.innerHTML = tempFn({
      timezones: this.timezones
    });
  }

  assignDomElements() {
    for (let key in elementsQuery) {
      if (elementsQuery.hasOwnProperty(key)) {
        this.domEl[key] = this.config
          .targetEl
          .querySelector(elementsQuery[key]);
      }
    }
  }

  prepareTimeZoneList() {
    this.timezones = moment.tz.names();
  }
}
