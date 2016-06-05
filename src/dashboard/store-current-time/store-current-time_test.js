import {
  StoreCurrentTime,
  __RewireAPI__ as StoreCurrentTimeRewireAPI
} from './store-current-time.js';

describe('StoreCurrentTime', () => {
  let momentMock;
  let momentValue = 123;

  beforeEach(() => {
    momentMock = jasmine.createSpy();
    momentMock.and.returnValue(momentValue);
  });

  beforeEach(() => {
    StoreCurrentTimeRewireAPI.__Rewire__('moment', momentMock);
  });

  describe('constructor', () => {
    let storeCurrentTime;

    beforeEach(() => {
      storeCurrentTime = new StoreCurrentTime();
    });

    it('should assign current time value during creation', () => {
      expect(storeCurrentTime.value).toBe(momentValue);
    });
  });

  describe('update', () => {
    let storeCurrentTime;
    let registeredFn;
    let registeredFn2;
    const newValue = 234;

    beforeEach(() => {
      storeCurrentTime = new StoreCurrentTime();
    });

    beforeEach(() => {
      registeredFn = jasmine.createSpy();
      registeredFn2 = jasmine.createSpy();

      storeCurrentTime.register(registeredFn);
      storeCurrentTime.register(registeredFn2);
    });

    it('should assign new value after update', () => {
      storeCurrentTime.update(newValue);
      expect(storeCurrentTime.value).toBe(newValue);
    });

    it('should invoke register function after update', () => {
      storeCurrentTime.update(newValue);

      expect(registeredFn).toHaveBeenCalledWith(newValue);
      expect(registeredFn2).toHaveBeenCalledWith(newValue);
    });
  });
});
