import {
  Dashboard,
  elementsQuery,
  exceptionMsg,
  __RewireAPI__ as DashboardRewireAPI
} from './dashboard.js';

describe('Dashboard config', () => {
  describe('passing config to constructor', () => {
    it('should throw error when config will be without target element', () => {
      expect(() => new Dashboard()).toThrow(new Error(exceptionMsg.noTargetEl));
    });

    it('should throw error when targetEl in config will be different then DOM element', () => {
      expect(() => new Dashboard({targetEl: 123})).toThrow(new Error(exceptionMsg.noDomTargetEl));
    });
  });
});

describe('Dashboard', () => {
  let NewTimezoneFormMock;
  let StoreCurrentTimeMock;
  let TimezoneCardMock;
  let momentMock;
  let dashboard;
  let divHolder;
  let config;

  beforeEach(() => {
    NewTimezoneFormMock = jasmine.createSpy();
    DashboardRewireAPI.__Rewire__('NewTimezoneForm', NewTimezoneFormMock);
  });

  beforeEach(() => {
    StoreCurrentTimeMock = jasmine.createSpy();
    DashboardRewireAPI.__Rewire__('StoreCurrentTime', StoreCurrentTimeMock);
  });

  beforeEach(() => {
    TimezoneCardMock = jasmine.createSpy();
    DashboardRewireAPI.__Rewire__('TimezoneCard', TimezoneCardMock);
  });

  beforeEach(() => {
    momentMock = {
      tz: jasmine.createSpyObj('tz', ['guess'])
    };
    momentMock.tz.guess.and.returnValue('Europe/Warsaw');
    DashboardRewireAPI.__Rewire__('moment', momentMock);
  });

  beforeEach(() => {
    divHolder = document.createElement('div');
    config = {
      targetEl: divHolder
    };

    dashboard = new Dashboard(config);
  });

  describe('constructor', () => {
    it('should assing config', () => {
      expect(dashboard.config).toBe(config);
    });

    it('should assing new object of StoreCurrentTime', () => {
      expect(StoreCurrentTimeMock).toHaveBeenCalled();
      expect(dashboard.storeCurrentTime).toBeDefined();
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
    it('should add new timezone form', () => {
      let lastCall = NewTimezoneFormMock
        .calls
        .mostRecent()
        .args[0];

      expect(lastCall.targetEl).toEqual(divHolder.querySelector(elementsQuery.addTzContainer));
      expect(lastCall.onAddTimezone).toEqual(jasmine.any(Function));
    });
  });

  describe('initialization main timezones', () => {
    it('should add two new timezone cards', () => {
      let lastCall = TimezoneCardMock
        .calls
        .mostRecent()
        .args[0];
      let firstCall = TimezoneCardMock
        .calls
        .first()
        .args[0];

      expect(TimezoneCardMock.calls.count()).toBe(2);
      expect(firstCall.timezone).toEqual('Europe/Warsaw');
      expect(lastCall.timezone).toEqual('GMT');
    });
  });

  describe('add new custom timezones', () => {
    it('should create TimezoneCard Object', () => {
      let lastCall;
      dashboard.addNewTimeZone('EST');
      
      lastCall = TimezoneCardMock
        .calls
        .mostRecent()
        .args[0];

      expect(lastCall.timezone).toEqual('EST');
    });
  });
});
