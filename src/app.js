import {Dashboard} from './dashboard/dashboard.js';

const config = {
  targetEl: document.querySelector('#main-content')
};

class App {
  constructor() {
    this.dashboard = new Dashboard(config);
  }
}

if (!window.__karma__) {
  const app = new App();// eslint-disable-line no-unused-vars
}

export {App, config};
