var fs = require('fs');
var Nedb = require('../lib/datastore');
var path = require('path');

describe('Load and crash', function () {
  var db;
  var dbPath = path.join(__dirname, '..', 'workspace', 'lac.db');

  beforeEach(function (done) {
    db = new Nedb({ filename: dbPath });
    done();
  });

  afterEach(function () {
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch (e) {}
  });

  it('can load database after potential crash simulation', function (done) {
    db.loadDatabase(function (err) {
      expect(err).toBeNull();
      done();
    });
  });
});
