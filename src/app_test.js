import {App, config, __RewireAPI__ as AppRewriteAPI} from './app.js';

let dashboardMock;
let app;

describe('App', () => {
  beforeEach(function () {
    dashboardMock = jasmine.createSpy();
  });

  beforeEach(function () {
    AppRewriteAPI.__Rewire__('Dashboard', dashboardMock);
  });

  beforeEach(function () {
    app = new App();
  });

  describe('constructor', () => {
    it('should create new dashboard instance', () => {
      expect(dashboardMock).toHaveBeenCalled();
    });

    it('should pass config to dashboard', () => {
      expect(dashboardMock).toHaveBeenCalledWith(config);
    });

    it('should have assigned dashboard object', () => {
      expect(app.dashboard).toBeDefined();
    });
  });
});
