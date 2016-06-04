import {Element, exceptionMsg} from './element.js';

describe('Element', () => {
  describe('passing config to constructor', () => {
    it('should throw error when config will be without target element', () => {
      expect(() => new Element())
        .toThrow(new Error(exceptionMsg.noTargetEl));
    });

    it('should throw error when targetEl in config will be different then DOM element', () => {
      expect(() => new Element({targetEl: 123}))
        .toThrow(new Error(exceptionMsg.noDomTargetEl));
    });
  });

  describe('constructor', () => {
    let element;
    let divHolder;
    let config;

    beforeEach(() => {
      divHolder = document.createElement('div');
      config = {
        targetEl: divHolder
      };

      element = new Element(config);
    });

    it('should assing config', () => {
      expect(element.config).toBe(config);
    });

    it('should have prepared object for a dom elements', () => {
      expect(element.domEl).toEqual(jasmine.any(Object));
    });
  });
});
