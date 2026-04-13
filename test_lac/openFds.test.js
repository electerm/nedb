var fs = require('fs');
var async = require('async');
var Nedb = require('../lib/datastore');
var path = require('path');

describe('Open file descriptors', function () {
  var db;
  var dbPath = path.join(__dirname, '..', 'workspace', 'openfds.db');
  var testFile = path.join(__dirname, 'openFdsTestFile');
  var testFile2 = path.join(__dirname, 'openFdsTestFile2');
  var N = 64;

  beforeEach(function (done) {
    db = new Nedb({ filename: dbPath, autoload: true });
    async.series([
      function (cb) {
        fs.writeFile(testFile, 'test content', cb);
      },
      function (cb) {
        fs.writeFile(testFile2, 'test content 2', cb);
      },
      function (cb) {
        db.remove({}, { multi: true }, cb);
      }
    ], done);
  });

  afterEach(function () {
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch (e) {}
  });

  it.skip('can handle many open file descriptors', function (done) {
    var i = 0;
    var fds = [];

    function multipleOpen(filename, count, callback) {
      async.whilst(
        function () { return i < count; },
        function (cb) {
          fs.open(filename, 'r', function (err, fd) {
            i++;
            if (fd) fds.push(fd);
            cb(err);
          });
        },
        callback
      );
    }

    async.series([
      function (cb) {
        i = 0;
        fds = [];
        multipleOpen(testFile, 2 * N + 1, function (err) {
          fds.forEach(function (fd) { fs.closeSync(fd); });
          cb();
        });
      },
      function (cb) {
        i = 0;
        fds = [];
        multipleOpen(testFile2, N, function (err) {
          fds.forEach(function (fd) { fs.closeSync(fd); });
          cb();
        });
      },
      function (cb) {
        db.insert({ hello: 'world' }, cb);
      },
      function (cb) {
        i = 0;
        async.whilst(
          function () { return i < 2 * N + 1; },
          function (callback) {
            db.persistence.persistCachedDatabase(function (err) {
              i++;
              callback(err);
            });
          },
          cb
        );
      }
    ], function (err) {
      expect(err).toBeNull();
      done();
    });
  });
});
