import template from './dashboard.html';
import {NewTimezoneForm} from './new-timezone-form/new-timezone-form.js';
import {TimezoneCard} from './timezone-card/timezone-card.js';
import {StoreCurrentTime} from './store-current-time/store-current-time.js';
import {Element, exceptionMsg} from './element/element.js';
import doT from 'dot';
import moment from 'moment-timezone';

export {exceptionMsg};

export const elementsQuery = {
  mainTzContainer: '#main-timezones-container',
  addTzContainer: '#add-timezone-container',
  additionalTzContainer: '#add-timezone-container'
};

export class Dashboard extends Element {
  constructor(config = {}) {
    super(config, elementsQuery);
    this.timezones = [];
  }

  render() {
    super.render();
    this.config.targetEl.innerHTML = doT.template(template)();
  }

  post() {
    super.post();
    this.storeCurrentTime = new StoreCurrentTime();
    this.addElements();
  }

  addElements() {
    this.addNewTimezoneForm();
    this.initMainTimezones();
  }

  addNewTimezoneForm() {
    new NewTimezoneForm({
      targetEl: this.domEl.addTzContainer,
      onAddTimezone: this.addNewTimeZone.bind(this)
    });
  }

  // TODO: TEST IT
  initMainTimezones() {
    new TimezoneCard({
      targetEl: this.domEl.mainTzContainer,
      time: this.storeCurrentTime.value,
      timezone: moment.tz.guess(),
      storeCurrentTime: this.storeCurrentTime
    });
    new TimezoneCard({
      targetEl: this.domEl.mainTzContainer,
      time: this.storeCurrentTime.value,
      timezone: 'GMT',
      storeCurrentTime: this.storeCurrentTime
    });
  }

  // TODO: TEST IT
  addNewTimeZone(value) {
    new TimezoneCard({
      targetEl: this.domEl.additionalTzContainer,
      time: this.storeCurrentTime.value,
      timezone: value,
      storeCurrentTime: this.storeCurrentTime
    });
  }
}
