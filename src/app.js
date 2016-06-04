import {Dashboard} from './dashboard/dashboard.js';

export const config = {};

export class App {
  constructor() {
    this.dashboard = new Dashboard(config);
  }
}

const app = new App();// eslint-disable-line no-unused-vars
