import {
  TimezoneCard,
  exceptionMsg,
  elementsQuery,
  __RewireAPI__ as TimezoneCardRewireAPI
} from './timezone-card.js';
import moment from 'moment-timezone';

describe('TimezoneCard', () => {
  let StoreCurrentTimeMock;
  beforeEach(() => {
    StoreCurrentTimeMock = function StoreCurrentTime() {
      this.register = jasmine.createSpy();
      this.unregister = jasmine.createSpy();
    };
    TimezoneCardRewireAPI.__Rewire__('StoreCurrentTime', StoreCurrentTimeMock);
  });

  describe('passing config to constructor', () => {
    it('should throw error when config will be without target element', () => {
      expect(() => new TimezoneCard())
        .toThrow(new Error(exceptionMsg.noTargetEl));
    });

    it('should throw error when targetEl in config will be different then DOM element', () => {
      expect(() => new TimezoneCard({targetEl: 123}))
        .toThrow(new Error(exceptionMsg.noDomTargetEl));
    });

    it('should throw error when there is no store current time value', () => {
      expect(() => new TimezoneCard({
        targetEl: document.createElement('div')
      }))
      .toThrow(new Error(exceptionMsg.noStoreCurrentTime));
    });

    it('should throw error when no store current have a different instance', () => {
      expect(() => new TimezoneCard({
        targetEl: document.createElement('div'),
        storeCurrentTime: function example() {}
      }))
      .toThrow(new Error(exceptionMsg.wrongInstance));
    });

    it('should throw error when there is no time in config', () => {
      expect(() => new TimezoneCard({
        targetEl: document.createElement('div'),
        storeCurrentTime: new StoreCurrentTimeMock()
      }))
      .toThrow(new Error(exceptionMsg.noTime));
    });

    it('should throw error when there is no timezone in config', () => {
      expect(() => new TimezoneCard({
        targetEl: document.createElement('div'),
        storeCurrentTime: new StoreCurrentTimeMock(),
        time: moment()
      }))
      .toThrow(new Error(exceptionMsg.noTimeZone));
    });
  });

  describe('constructor', () => {
    let timezoneCard;
    let divHolder;
    let StoreCurrentTime;
    let config;

    beforeEach(() => {
      divHolder = document.createElement('div');
      StoreCurrentTime = new StoreCurrentTimeMock();
      config = {
        targetEl: divHolder,
        storeCurrentTime: StoreCurrentTime,
        time: moment(),
        timezone: 'GMT'
      };

      timezoneCard = new TimezoneCard(config);
    });

    it('should assing config', () => {
      expect(timezoneCard.config).toBe(config);
    });

    it('should assign storeCurrentTime', () => {
      expect(timezoneCard.storeCurrentTime).toEqual(StoreCurrentTime);
    });

    it('should have prepared object for a dom elements', () => {
      expect(timezoneCard.domEl).toEqual(jasmine.any(Object));
    });

    it('should render time-container', () => {
      expect(divHolder.querySelector(elementsQuery.timeContainer).tagName).toBeDefined();
    });

    it('should render deleteIcon', () => {
      expect(divHolder.querySelector(elementsQuery.deleteIcon).tagName).toBeDefined();
    });

    it('should render dateInput', () => {
      expect(divHolder.querySelector(elementsQuery.dateInput).tagName).toBeDefined();
    });

    it('should render timeInput', () => {
      expect(divHolder.querySelector(elementsQuery.timeInput).tagName).toBeDefined();
    });

    it('should render changeButton', () => {
      expect(divHolder.querySelector(elementsQuery.changeButton).tagName).toBeDefined();
    });

    it('should have assigned proper dom elements', () => {
      expect(timezoneCard.domEl.timeContainer)
        .toEqual(divHolder.querySelector(elementsQuery.timeContainer));
      expect(timezoneCard.domEl.deleteIcon)
        .toEqual(divHolder.querySelector(elementsQuery.deleteIcon));
      expect(timezoneCard.domEl.dateInput)
        .toEqual(divHolder.querySelector(elementsQuery.dateInput));
      expect(timezoneCard.domEl.timeInput)
        .toEqual(divHolder.querySelector(elementsQuery.timeInput));
      expect(timezoneCard.domEl.changeButton)
        .toEqual(divHolder.querySelector(elementsQuery.changeButton));
    });
  });
});
