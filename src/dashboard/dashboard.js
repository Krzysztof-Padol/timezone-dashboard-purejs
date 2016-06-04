import template from './dashboard.html';
import doT from 'dot';

export const exceptionMsg = {
  noTargetEl: 'You should pass targetEl (DOM element) in config',
  noDomTargetEl: 'You should DOM element as a targetEl in config',
}

export const elementsQuery = {
  mainTzContainer: '#main-timezones-container',
  addTzContainer: '#add-timezone-container',
  additionalTzContainer: '#add-timezone-container',
};

export class Dashboard {
  constructor(config = {}) {
    this.config = config;
    this.checkConfig();
    this.timezones = [];
    this.domEl = {};

    // init
    this.render();
    this.assignDomElements();
  }

  checkConfig() {
    if (!this.config.targetEl) {
      throw new Error(exceptionMsg.noTargetEl);
    } else if(this.config.targetEl && !this.config.targetEl.tagName) {
      throw new Error(exceptionMsg.noDomTargetEl);
    }
  }

  render() {
    this.config.targetEl.innerHTML = doT.template(template)();
  }

  assignDomElements() {
    for(let key in elementsQuery) {
      if(elementsQuery.hasOwnProperty(key)) {
        this.domEl[key] = this.config
          .targetEl
          .querySelector(elementsQuery[key]);
      } 
    }
  }
}
