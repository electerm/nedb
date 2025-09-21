/**
 * Minimal underscore.js replacement with only the functions needed by nedb
 * This replaces the full underscore library to reduce dependencies
 */

/**
 * Returns the intersection of arrays - elements that appear in all arrays
 * @param {Array} array - First array
 * @param {...Array} arrays - Additional arrays to intersect with
 * @returns {Array} - Array of elements that appear in all input arrays
 */
function intersection(array) {
  if (!Array.isArray(array)) return [];
  
  var result = [];
  var argsLength = arguments.length;
  
  for (var i = 0; i < array.length; i++) {
    var item = array[i];
    var included = true;
    
    // Check if item exists in all other arrays
    for (var j = 1; j < argsLength; j++) {
      var otherArray = arguments[j];
      if (!Array.isArray(otherArray) || otherArray.indexOf(item) === -1) {
        included = false;
        break;
      }
    }
    
    // Add to result if not already there and exists in all arrays
    if (included && result.indexOf(item) === -1) {
      result.push(item);
    }
  }
  
  return result;
}

/**
 * Extracts property values from an array of objects
 * @param {Array} array - Array of objects
 * @param {String} property - Property name to extract
 * @returns {Array} - Array of extracted property values
 */
function pluck(array, property) {
  if (!Array.isArray(array)) return [];
  
  var result = [];
  for (var i = 0; i < array.length; i++) {
    if (array[i] && array[i].hasOwnProperty(property)) {
      result.push(array[i][property]);
    }
  }
  return result;
}

/**
 * Returns a copy of object with specified keys omitted
 * @param {Object} obj - Source object
 * @param {...String} keys - Keys to omit
 * @returns {Object} - New object without the omitted keys
 */
function omit(obj) {
  if (typeof obj !== 'object' || obj === null) return {};
  
  var result = {};
  var keysToOmit = Array.prototype.slice.call(arguments, 1);
  
  for (var key in obj) {
    if (obj.hasOwnProperty(key) && keysToOmit.indexOf(key) === -1) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Checks if object has the given key as a direct property
 * @param {Object} obj - Object to check
 * @param {String} key - Key to check for
 * @returns {Boolean} - True if object has the key
 */
function has(obj, key) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Creates a new array with results of calling provided function on every element
 * @param {Array} array - Array to map over
 * @param {Function} iteratee - Function to call for each element
 * @returns {Array} - New array with mapped values
 */
function map(array, iteratee) {
  if (!Array.isArray(array) || typeof iteratee !== 'function') return [];
  
  var result = [];
  for (var i = 0; i < array.length; i++) {
    result.push(iteratee(array[i], i, array));
  }
  return result;
}

/**
 * Creates a new array with all elements that pass the test implemented by provided function
 * @param {Array} array - Array to filter
 * @param {Function} predicate - Function to test each element
 * @returns {Array} - New array with filtered elements
 */
function filter(array, predicate) {
  if (!Array.isArray(array) || typeof predicate !== 'function') return [];
  
  var result = [];
  for (var i = 0; i < array.length; i++) {
    if (predicate(array[i], i, array)) {
      result.push(array[i]);
    }
  }
  return result;
}

/**
 * Creates a duplicate-free version of an array
 * @param {Array} array - Array to make unique
 * @param {Function} iteratee - Optional function to compute uniqueness criterion
 * @returns {Array} - New array with unique values
 */
function uniq(array, iteratee) {
  if (!Array.isArray(array)) return [];
  
  var result = [];
  var seen = [];
  
  for (var i = 0; i < array.length; i++) {
    var value = array[i];
    var computed = iteratee ? iteratee(value) : value;
    
    if (seen.indexOf(computed) === -1) {
      seen.push(computed);
      result.push(value);
    }
  }
  
  return result;
}

/**
 * Checks if value is a function
 * @param {*} value - Value to check
 * @returns {Boolean} - True if value is a function
 */
function isFunction(value) {
  return typeof value === 'function';
}

/**
 * Checks if value is a boolean
 * @param {*} value - Value to check  
 * @returns {Boolean} - True if value is a boolean
 */
function isBoolean(value) {
  return typeof value === 'boolean';
}

// Export the functions
module.exports = {
  intersection: intersection,
  pluck: pluck,
  omit: omit,
  has: has,
  map: map,
  filter: filter,
  uniq: uniq,
  isFunction: isFunction,
  isBoolean: isBoolean
};
