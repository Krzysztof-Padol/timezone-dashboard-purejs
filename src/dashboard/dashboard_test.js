import {
  Dashboard,
  elementsQuery,
  exceptionMsg,
  __RewireAPI__ as DashboardRewireAPI
} from './dashboard.js';

describe('Dashboard', () => {
  let NewTimezoneFormMock;

  beforeEach(() => {
    NewTimezoneFormMock = jasmine.createSpy();
    DashboardRewireAPI.__Rewire__('NewTimezoneForm', NewTimezoneFormMock);
  });

  describe('passing config to constructor', () => {
    it('should throw error when config will be without target element', () => {
      function fn() {
        new Dashboard();
      }

      expect(fn()).toThrow(new Error(exceptionMsg.noTargetEl));
    });

    it('should throw error when targetEl in config will be different then DOM element', () => {
      function fn() {
        new Dashboard({targetEl: 123});
      }

      expect(fn()).toThrow(new Error(exceptionMsg.noDomTargetEl));
    });
  });

  describe('constructor', () => {
    let dashboard;
    let divHolder;
    let config;

    beforeEach(() => {
      divHolder = document.createElement('div');
      config = {
        targetEl: divHolder
      };

      dashboard = new Dashboard(config);
    });

    it('should assing config', () => {
      expect(dashboard.config).toBe(config);
    });

    it('should create empty array of timezones', () => {
      expect(dashboard.timezones).toEqual(jasmine.any(Array));
      expect(dashboard.timezones.length).toEqual(0);
    });

    it('should have prepared object for a dom elements', () => {
      expect(dashboard.domEl).toEqual(jasmine.any(Object));
    });

    it('should render three containers', () => {
      expect(divHolder.querySelector(elementsQuery.mainTzContainer).id).toBeDefined();
      expect(divHolder.querySelector(elementsQuery.addTzContainer).id).toBeDefined();
      expect(divHolder.querySelector(elementsQuery.additionalTzContainer).id).toBeDefined();
    });

    it('should have assigned proper dom elements', () => {
      expect(dashboard.domEl.mainTzContainer)
        .toEqual(divHolder.querySelector(elementsQuery.mainTzContainer));
      expect(dashboard.domEl.addTzContainer)
        .toEqual(divHolder.querySelector(elementsQuery.addTzContainer));
      expect(dashboard.domEl.additionalTzContainer)
        .toEqual(divHolder.querySelector(elementsQuery.additionalTzContainer));
    });
  });

  describe('add elements function', () => {
    let divHolder;
    let config;

    beforeEach(() => {
      divHolder = document.createElement('div');
      config = {
        targetEl: divHolder
      };

      new Dashboard(config);
    });

    it('should add new timezone form', () => {
      expect(NewTimezoneFormMock).toHaveBeenCalledWith({
        targetEl: divHolder.querySelector(elementsQuery.addTzContainer)
      });
    });
  });
});
