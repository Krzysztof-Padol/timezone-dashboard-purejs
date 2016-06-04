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

  post() {}

  assignDomElements() {
    for (let key in this.elementsQuery) {
      if (this.elementsQuery.hasOwnProperty(key)) {
        this.domEl[key] = this.config
          .targetEl
          .querySelector(this.elementsQuery[key]);
      }
    }
  }
}
