var testDb = 'workspace/test.db';
var fs = require('fs');
var path = require('path');
var Datastore = require('../lib/datastore');
var Persistence = require('../lib/persistence');

function testThrowInCallback(d, done) {
  var currentUncaughtExceptionHandlers = process.listeners('uncaughtException');

  process.removeAllListeners('uncaughtException');

  process.on('uncaughtException', function (err) {
  });

  d.find({}, function (err) {
    process.nextTick(function () {
      d.insert({ bar: 1 }, function (err) {
        process.removeAllListeners('uncaughtException');
        for (var i = 0; i < currentUncaughtExceptionHandlers.length; i += 1) {
          process.on('uncaughtException', currentUncaughtExceptionHandlers[i]);
        }

        done();
      });
    });

    throw new Error('Some error');
  });
}

function testFalsyCallback(d, done) {
  d.insert({ a: 1 }, null);
  process.nextTick(function () {
    d.update({ a: 1 }, { a: 2 }, {}, null);
    process.nextTick(function () {
      d.update({ a: 2 }, { a: 1 }, null);
      process.nextTick(function () {
        d.remove({ a: 2 }, {}, null);
        process.nextTick(function () {
          d.remove({ a: 2 }, null);
          process.nextTick(function () {
            d.find({}, done);
          });
        });
      });
    });
  });
}

function testRightOrder(d, done) {
  var currentUncaughtExceptionHandlers = process.listeners('uncaughtException');

  process.removeAllListeners('uncaughtException');

  process.on('uncaughtException', function (err) {
  });

  d.find({}, function (err, docs) {
    expect(docs.length).toBe(0);

    d.insert({ a: 1 }, function () {
      d.update({ a: 1 }, { a: 2 }, {}, function () {
        d.find({}, function (err, docs) {
          expect(docs[0].a).toBe(2);

          process.nextTick(function () {
            d.update({ a: 2 }, { a: 3 }, {}, function () {
              d.find({}, function (err, docs) {
                expect(docs[0].a).toBe(3);

                process.removeAllListeners('uncaughtException');
                for (var i = 0; i < currentUncaughtExceptionHandlers.length; i += 1) {
                  process.on('uncaughtException', currentUncaughtExceptionHandlers[i]);
                }

                done();
              });
            });
          });

          throw new Error('Some error');
        });
      });
    });
  });
}

var testEventLoopStarvation = function(d, done){
  var times = 1001;
  var i = 0;
  while ( i < times) {
    i++;
    d.find({"bogus": "search"}, function (err, docs) {
    });
  }
  done();
};

function testExecutorWorksWithoutCallback(d, done) {
  d.insert({ a: 1 });
  d.insert({ a: 2 }, false);
  d.find({}, function (err, docs) {
    expect(docs.length).toBe(2);
    done();
  });
}

describe('Executor', function () {
  describe('With persistent database', function () {
    var d;

    beforeEach(function (done) {
      d = new Datastore({ filename: testDb });
      expect(d.filename).toBe(testDb);
      expect(d.inMemoryOnly).toBe(false);

      Persistence.ensureDirectoryExists(path.dirname(testDb), function () {
        fs.exists(testDb, function (exists) {
          if (exists) {
            fs.unlink(testDb, function () {
              d.loadDatabase(function (err) {
                expect(err).toBeNull();
                expect(d.getAllData().length).toBe(0);
                done();
              });
            });
          } else {
            d.loadDatabase(function (err) {
              expect(err).toBeNull();
              expect(d.getAllData().length).toBe(0);
              done();
            });
          }
        });
      });
    });

    it('A throw in a callback doesnt prevent execution of next operations', function(done) {
      testThrowInCallback(d, done);
    });

    it('A falsy callback doesnt prevent execution of next operations', function(done) {
      testFalsyCallback(d, done);
    });

    it('Operations are executed in the right order', function(done) {
      testRightOrder(d, done);
    });

    it('Does not starve event loop and raise warning when more than 1000 callbacks are in queue', function(done){
      testEventLoopStarvation(d, done);
    });

    it('Works in the right order even with no supplied callback', function(done){
      testExecutorWorksWithoutCallback(d, done);
    });
  });

  describe('With non persistent database', function () {
    var d;

    beforeEach(function (done) {
      d = new Datastore({ inMemoryOnly: true });
      expect(d.inMemoryOnly).toBe(true);

      d.loadDatabase(function (err) {
        expect(err).toBeNull();
        expect(d.getAllData().length).toBe(0);
        return done();
      });
    });

    it('A throw in a callback doesnt prevent execution of next operations', function(done) {
      testThrowInCallback(d, done);
    });

    it('A falsy callback doesnt prevent execution of next operations', function(done) {
      testFalsyCallback(d, done);
    });

    it('Operations are executed in the right order', function(done) {
      testRightOrder(d, done);
    });

    it('Works in the right order even with no supplied callback', function(done){
      testExecutorWorksWithoutCallback(d, done);
    });
  });
});