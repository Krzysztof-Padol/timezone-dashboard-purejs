export const exceptionMsg = {
  noTargetEl: 'You should pass targetEl (DOM element) in config',
  noDomTargetEl: 'You should DOM element as a targetEl in config'
};

export class Element {
  constructor(config = {}, elementsQuery = {}) {
    this.config = config;
    this.elementsQuery = elementsQuery;
    this.checkConfig();
    this.domEl = {};

    // init
    this.preRender();
    this.render();
    this.postRender();
    this.assignDomElements();
    this.post();

    this.smartListeners = {};
    this.addListeners();
  }

  checkConfig() {
    if (!this.config.targetEl) {
      throw new Error(exceptionMsg.noTargetEl);
    } else if (this.config.targetEl && !this.config.targetEl.tagName) {
      throw new Error(exceptionMsg.noDomTargetEl);
    }
  }

  preRender() {}

  render() {}

  postRender() {}

  addListeners() {}

  post() {}

  addSmartListeners(elKey, eventName, cb) {
    if (!this.smartListeners[elKey]) {
      this.smartListeners[elKey] = {};
    }

    this.smartListeners[elKey][eventName] = cb;
    this.domEl[elKey].addEventListener('click', cb);
  }

  removeAllSmartListeners() {
    Object.keys(this.smartListeners).forEach((elKey) => {
      Object.keys(this.smartListeners[elKey]).forEach((eventName) => {
        this.domEl[elKey]
          .removeEventListener(
            eventName,
            this.smartListeners[elKey][eventName]
          );

        delete this.smartListeners[elKey][eventName];
      });
    });
  }

  assignDomElements() {
    for (let key in this.elementsQuery) {
      if (this.elementsQuery.hasOwnProperty(key)) {
        this.domEl[key] = this.config
          .targetEl
          .querySelector(this.elementsQuery[key]);
      }
    }
  }

  removeElement() {
    this.removeAllSmartListeners();
    this.config.targetEl.parentNode.removeChild(this.config.targetEl);
  }
}
