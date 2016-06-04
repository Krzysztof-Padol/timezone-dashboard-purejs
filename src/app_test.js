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

  describe('constructor', () => {
    beforeEach(function () {
      app = new App();
    });

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

  describe('config', () => {
    it("should have targetEl defined", function() {
      expect(config.targetEl).toBeDefined();
    });
  });
});
