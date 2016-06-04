import template from './dashboard.html';
import {NewTimezoneForm} from './new-timezone-form/new-timezone-form.js';
import {Element, exceptionMsg} from './element/element.js';
import doT from 'dot';

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
    this.addElements();
  }

  addElements() {
    this.addNewTimezoneForm();
  }

  addNewTimezoneForm() {
    new NewTimezoneForm({
      targetEl: this.domEl.addTzContainer
    });
  }
}
