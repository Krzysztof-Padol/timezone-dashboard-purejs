import {Element, exceptionMsg} from './element.js';
import doT from 'dot';

describe('Element no config', () => {
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
});

describe('Element', () => {
  let element;
  let divHolder;
  let divWrapper;
  let conf;

  const elementsQuery = {
    main: '.main',
    one: '.one',
    two: '.two'
  };

  beforeEach(() => {
    divHolder = document.createElement('div');
    divWrapper = document.createElement('div');
    conf = {
      targetEl: divHolder
    };

    divWrapper.appendChild(divHolder);

    class ChildElement extends Element {
      constructor(config) {
        super(config, elementsQuery);
      }

      render() {
        let tempFn = doT.template(`
            <div class="main">
              <div class="one"></div>
              <div class="two"></div>
            </div>
          `);

        this.config.targetEl.innerHTML = tempFn();
      }
    }

    element = new ChildElement(conf, elementsQuery);
  });

  describe('constructor', () => {
    it('should assing config', () => {
      expect(element.config).toBe(conf);
    });

    it('should have prepared object for a dom elements', () => {
      expect(element.domEl).toEqual(jasmine.any(Object));
    });
  });

  describe('assign dom elements', () => {
    it('should have domEl defined', () => {
      expect(element.domEl).toBeDefined();
      expect(element.domEl).toEqual(jasmine.any(Object));
    });

    it('should have assigned dom elements to domEl', () => {
      expect(element.domEl.main)
        .toEqual(divHolder.querySelector(elementsQuery.main));
      expect(element.domEl.one)
        .toEqual(divHolder.querySelector(elementsQuery.one));
      expect(element.domEl.two)
        .toEqual(divHolder.querySelector(elementsQuery.two));
    });
  });

  describe('Smart listeners', () => {
    it('should have addSmartListeners method defined', () => {
      expect(element.addSmartListeners).toBeDefined();
    });

    it('should have removeAllSmartListeners method defined', () => {
      expect(element.removeAllSmartListeners).toBeDefined();
    });

    it('should have add element to array when addSmartListeners is called', () => {
      let cb = jasmine.createSpy();
      element.addSmartListeners('one', 'click', cb);

      expect(element.smartListeners.one.click).toEqual(cb);
    });

    it(`should have remove element from array when
        removeAllSmartListeners is called`, () => {
      let cb = jasmine.createSpy();
      element.addSmartListeners('one', 'click', cb);
      element.removeAllSmartListeners();

      expect(element.smartListeners.one.click).not.toBeDefined();
    });

    it('should invoke cb after click', () => {
      let cb = jasmine.createSpy();
      element.addSmartListeners('one', 'click', cb);

      element.domEl.one.click();
      expect(cb).toHaveBeenCalled();
    });

    it('should not invoke cb after click when listener was removed', () => {
      let cb = jasmine.createSpy();
      element.addSmartListeners('one', 'click', cb);
      element.removeAllSmartListeners();

      element.domEl.one.click();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('removeElement', () => {
    it(`should have remove element from listeners array when
        removeElement is called`, () => {
      let cb = jasmine.createSpy();
      element.addSmartListeners('one', 'click', cb);
      element.removeElement();

      expect(element.smartListeners.one.click).not.toBeDefined();
    });

    it('should invoke remove element from divHolder after click on delete', () => {
      element.removeElement();
      expect(divWrapper.querySelector(elementsQuery.main)).toBe(null);
    });
  });
});
