import {Observer} from './observer.js';

describe('Observer', () => {
  describe('constructor', () => {
    let observer;

    beforeEach(() => {
      observer = new Observer();
    });

    it('should have empty array of registered elements', () => {
      expect(observer.registered).toEqual(jasmine.any(Array));
      expect(observer.registered.length).toEqual(0);
    });
  });

  describe('register/unregister functionality', () => {
    let observer;
    let registeredFn;
    let registeredFn2;

    beforeEach(() => {
      registeredFn = jasmine.createSpy();
      registeredFn2 = jasmine.createSpy();
      observer = new Observer();
    });

    it('should add function to array after calling register method', () => {
      observer.register(registeredFn);

      expect(observer.registered[0]).toEqual(registeredFn);
      expect(observer.registered.length).toEqual(1);
    });

    it('should add second function to array after calling register method', () => {
      observer.register(registeredFn);
      observer.register(registeredFn2);

      expect(observer.registered[1]).toEqual(registeredFn2);
      expect(observer.registered.length).toEqual(2);
    });

    it('should remove first function from array after calling unregister method', () => {
      observer.register(registeredFn);
      observer.register(registeredFn2);

      observer.unregister(registeredFn);

      expect(observer.registered[0]).toEqual(registeredFn2);
      expect(observer.registered.length).toEqual(1);
    });

    it('should remove also second function from array after calling unregister method', () => {
      observer.register(registeredFn);
      observer.register(registeredFn2);

      observer.unregister(registeredFn);
      observer.unregister(registeredFn2);

      expect(observer.registered.length).toEqual(0);
    });

    it('should call registered function after calling fire method', () => {
      const exampleVal = 123;

      observer.register(registeredFn);
      observer.fire(exampleVal);

      expect(registeredFn).toHaveBeenCalledWith(123);

      observer.register(registeredFn2);
      observer.fire(exampleVal);

      expect(registeredFn2).toHaveBeenCalledWith(123);
    });
  });
});
