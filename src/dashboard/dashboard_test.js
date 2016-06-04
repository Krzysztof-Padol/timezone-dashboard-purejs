import {Dashboard, elementsQuery, exceptionMsg} from './dashboard.js';

describe('Dashboard', () => {

  describe('passing config to constructor', () => {
    it("should throw error when config will be without target element", function() {
      expect(() => { new Dashboard() }).toThrow(new Error(exceptionMsg.noTargetEl));
    });

    it("should throw error when targetEl in config will be different then DOM element", function() {
      expect(() => { new Dashboard({ targetEl: 123 }) }).toThrow(new Error(exceptionMsg.noDomTargetEl));
    });
  });

  describe('constructor', () => {
    let dashboard;
    let divHolder;
    let config;

    beforeEach(function () {
      divHolder = document.createElement('div');
      config = {
        targetEl: divHolder
      };

      dashboard = new Dashboard(config);  
    });

    it("should assing config", function() {
      expect(dashboard.config).toBe(config);
    });

    it("should create empty array of timezones", function() {
      expect(dashboard.timezones).toEqual(jasmine.any(Array));
      expect(dashboard.timezones.length).toEqual(0);
    });

    it("should render three containers", function() {
      expect(divHolder.querySelector(elementsQuery.mainTzContainer).id).toBeDefined();
      expect(divHolder.querySelector(elementsQuery.addTzContainer).id).toBeDefined();
      expect(divHolder.querySelector(elementsQuery.additionalTzContainer).id).toBeDefined();
    });
  });
});
