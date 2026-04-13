/**
 * Custom async utilities to replace the async library
 * Uses modern async/await internally while maintaining callback compatibility
 */

/**
 * Promisify a callback-based function
 */
function promisify(fn) {
  return function(...args) {
    return new Promise((resolve, reject) => {
      fn(...args, (err, ...results) => {
        if (err) reject(err);
        else resolve(results.length <= 1 ? results[0] : results);
      });
    });
  };
}

/**
 * Execute functions in series (waterfall pattern)
 * Each function receives the result of the previous function as its parameters (except the last which is always the callback)
 */
function waterfall(tasks, finalCallback) {
  finalCallback = finalCallback || function() {};
  
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return finalCallback(null);
  }
  
  let taskIndex = 0;
  
  function runNextTask(err, ...results) {
    if (err) {
      return finalCallback(err);
    }
    
    if (taskIndex >= tasks.length) {
      return finalCallback(null, ...results);
    }
    
    const task = tasks[taskIndex++];
    
    try {
      if (typeof task === 'function') {
        // Regular function
        if (taskIndex === 1) {
          // First task gets only the callback
          task(runNextTask);
        } else {
          // Subsequent tasks get results from previous task, then callback
          task(...results, runNextTask);
        }
      } else if (task && task.__async_apply) {
        // Handle async.apply case
        const args = [...task.args];
        if (taskIndex > 1) {
          // If not the first task, add results from previous task
          args.push(...results);
        }
        args.push(runNextTask);
        task.fn.apply(null, args);
      } else {
        return finalCallback(new Error('Invalid task in waterfall'));
      }
    } catch (error) {
      return finalCallback(error);
    }
  }
  
  runNextTask();
}

/**
 * Apply partial application to a function (like async.apply)
 */
function apply(fn, ...args) {
  return {
    __async_apply: true,
    fn: fn,
    args: args
  };
}

/**
 * Execute a function for each item in an array, in series
 */
function eachSeries(array, iterator, callback) {
  callback = callback || function() {};
  
  let index = 0;
  
  function processNext(err) {
    if (err) {
      return callback(err);
    }
    
    if (index >= array.length) {
      return callback(null);
    }
    
    const item = array[index++];
    
    try {
      iterator(item, processNext);
    } catch (error) {
      return callback(error);
    }
  }
  
  processNext();
}

/**
 * Execute a function for each item in an array, in parallel
 */
function each(array, iterator, callback) {
  callback = callback || function() {};
  
  if (array.length === 0) {
    return callback(null);
  }
  
  let completed = 0;
  let hasError = false;
  
  array.forEach(function(item) {
    iterator(item, function(err) {
      if (hasError) return;
      
      if (err) {
        hasError = true;
        return callback(err);
      }
      
      completed++;
      if (completed === array.length) {
        callback(null);
      }
    });
  });
}

/**
 * Execute a function repeatedly while a condition is true
 */
function whilst(test, iterator, callback) {
  callback = callback || function() {};
  
  function iterate(err) {
    if (err) {
      return callback(err);
    }
    
    if (!test()) {
      return callback(null);
    }
    
    try {
      iterator(iterate);
    } catch (error) {
      return callback(error);
    }
  }
  
  iterate();
}

/**
 * Task queue implementation
 */
function queue(worker, concurrency = 1) {
  const tasks = [];
  let running = 0;
  let paused = false;

  function processTasks() {
    while (tasks.length > 0 && running < concurrency && !paused) {
      const task = tasks.shift();
      running++;
      
      worker(task.data, function(err) {
        running--;
        task.callback(err);
        
        // Process next tasks
        if (tasks.length > 0) {
          setImmediate(processTasks);
        }
      });
    }
  }

  return {
    push: function(data, callback) {
      callback = callback || function() {};
      tasks.push({ data, callback });
      setImmediate(processTasks);
    },
    
    unshift: function(data, callback) {
      callback = callback || function() {};
      tasks.unshift({ data, callback });
      setImmediate(processTasks);
    },
    
    pause: function() {
      paused = true;
    },
    
    resume: function() {
      paused = false;
      setImmediate(processTasks);
    },
    
    length: function() {
      return tasks.length;
    },
    
    running: function() {
      return running;
    },
    
    idle: function() {
      return tasks.length === 0 && running === 0;
    }
  };
}

module.exports = {
  waterfall,
  apply,
  eachSeries,
  each,
  whilst,
  queue
};
