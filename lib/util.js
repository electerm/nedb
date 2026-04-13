var util = require('util');

function isDate(obj) {
  return Object.prototype.toString.call(obj) === '[object Date]';
}

function isRegExp(obj) {
  return Object.prototype.toString.call(obj) === '[object RegExp]';
}

function isArray(obj) {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(obj);
  }
  return util.isArray(obj);
}

function inherits(ctor, superCtor) {
  if (ctor === undefined || ctor === null) {
    throw new TypeError('The constructor to inherit from must not be null or undefined');
  }
  if (typeof superCtor !== 'function') {
    throw new TypeError('The super constructor must be a function');
  }
  ctor.super_ = superCtor;
  Object.defineProperty(ctor, 'prototype', {
    value: Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    })
  });
}

module.exports = {
  isDate: isDate,
  isRegExp: isRegExp,
  isArray: isArray,
  inherits: inherits,
  util: util
};