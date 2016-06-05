class Observer {
  constructor() {
    this.registered = [];
  }

  register(fn) {
    this.registered.push(fn);
  }

  unregister(fn) {
    this.registered = this.registered.filter((item) => {
      if (item !== fn) {
        return item;
      }
    });
  }

  fire(value) {
    this.registered.forEach((fn) => {
      fn(value);
    });
  }

}

export {Observer};
