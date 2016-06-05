/**
 * Error messages used in commont element class
 * @type {[type]}
 */
export const exceptionMsg = {
  noTargetEl: 'You should pass targetEl (DOM element) in config',
  noDomTargetEl: 'You should DOM element as a targetEl in config'
};

export class Element {
  /**
   * Common element class used for rendering keeping
   * consistency of lifecycle elements in app
   * and handling managment of event listerers of obj
   *
   * Class also assigning searched elements using passsed
   * in elementsQuery object paths for a DOM elements.
   * @param  {Object} config        config contains only targetEl
   * @param  {Object} elementsQuery object with paths to DOM el
   */
  constructor(config = {}, elementsQuery = {}) {
    this.config = config;
    this.elementsQuery = elementsQuery;
    this.checkConfig();
    this.domEl = {};

    // initialization element lifecicle
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

  /**
   * Smart listeners assigning event to elements
   * and keeping the most important information in class
   * During removing element from DOM, all listeners
   * will be automatically cleaned.
   * @param {[type]}   elKey     element key passed in elementsQuery
   *                             during initialization of element
   * @param {[type]}   eventName simple event type which will be
   *                             listened on element
   * @param {Function} cb        function triggered when event
   *                             will be fired
   */
  addSmartListeners(elKey, eventName, cb) {
    if (!this.smartListeners[elKey]) {
      this.smartListeners[elKey] = {};
    }

    this.smartListeners[elKey][eventName] = cb;
    this.domEl[elKey].addEventListener('click', cb);
  }

  /**
   * Cleaning all listeners assigned in element
   */
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

  /**
   * Searching elements passed in constructor
   * and assigning it to obj for a cache purpose
   */
  assignDomElements() {
    for (let key in this.elementsQuery) {
      if (this.elementsQuery.hasOwnProperty(key)) {
        this.domEl[key] = this.config
          .targetEl
          .querySelector(this.elementsQuery[key]);
      }
    }
  }

  /**
   * Just cleaning all listeners and removing it
   * from DOM parent node
   */
  removeElement() {
    this.removeAllSmartListeners();
    this.config.targetEl.parentNode.removeChild(this.config.targetEl);
  }
}
