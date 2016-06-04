import template from './dashboard.html';
import doT from 'dot';

export const elementsQuery = {

};

export class Dashboard {
  constructor(config = {}) {
    this.config = config;
    this.timezones = [];

    // init
    this.render();
  }

  render() {
    this.config.targetEl.innerHTML = doT.template(template)();
  }

  assignDomElements() {

  }
}
