import {NewTimezoneForm, exceptionMsg, elementsQuery} from './new-timezone-form.js';

describe('NewTimezoneForm', () => {
  describe('passing config to constructor', () => {
    it('should throw error when config will be without target element', () => {
      function fn() {
        new NewTimezoneForm();
      }

      expect(fn()).toThrow(new Error(exceptionMsg.noTargetEl));
    });

    it('should throw error when targetEl in config will be different then DOM element', () => {
      function fn() {
        new NewTimezoneForm({targetEl: 123});
      }

      expect(fn()).toThrow(new Error(exceptionMsg.noDomTargetEl));
    });
  });

  describe('constructor', () => {
    let newTimezoneForm;
    let divHolder;
    let config;

    beforeEach(() => {
      divHolder = document.createElement('div');
      config = {
        targetEl: divHolder
      };

      newTimezoneForm = new NewTimezoneForm(config);
    });

    it('should assing config', () => {
      expect(newTimezoneForm.config).toBe(config);
    });

    it('should create empty array of timezones', () => {
      expect(newTimezoneForm.timezones).toEqual(jasmine.any(Array));
    });

    it('should have prepared object for a dom elements', () => {
      expect(newTimezoneForm.domEl).toEqual(jasmine.any(Object));
    });

    it('should render dropdown', () => {
      expect(divHolder.querySelector(elementsQuery.selectList).tagName).toBeDefined();
    });

    it('should render submit button', () => {
      expect(divHolder.querySelector(elementsQuery.submitButton).tagName).toBeDefined();
    });

    it('should have assigned proper dom elements', () => {
      expect(newTimezoneForm.domEl.selectList)
        .toEqual(divHolder.querySelector(elementsQuery.selectList));
      expect(newTimezoneForm.domEl.submitButton)
        .toEqual(divHolder.querySelector(elementsQuery.submitButton));
    });
  });
});
