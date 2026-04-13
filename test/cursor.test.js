var testDb = 'workspace/test.db';
var fs = require('fs');
var path = require('path');
var Datastore = require('../lib/datastore');
var Persistence = require('../lib/persistence');
var Cursor = require('../lib/cursor');

describe('Cursor', function () {
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

  describe('Without sorting', function () {
    beforeEach(function (done) {
      d.insert({ age: 5 }, function (err) {
        d.insert({ age: 57 }, function (err) {
          d.insert({ age: 52 }, function (err) {
            d.insert({ age: 23 }, function (err) {
              d.insert({ age: 89 }, function (err) {
                return done();
              });
            });
          });
        });
      });
    });

    it('Without query, an empty query or a simple query and no skip or limit', function (done) {
      var cursor = new Cursor(d);
      cursor.exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(5);
        var ages = docs.map(function(doc) { return doc.age; });
        expect(ages).toContain(5);
        expect(ages).toContain(57);
        expect(ages).toContain(52);
        expect(ages).toContain(23);
        expect(ages).toContain(89);

        var cursor2 = new Cursor(d, {});
        cursor2.exec(function (err, docs) {
          expect(err).toBeNull();
          expect(docs.length).toBe(5);

          var cursor3 = new Cursor(d, { age: { $gt: 23 } });
          cursor3.exec(function (err, docs) {
            expect(err).toBeNull();
            expect(docs.length).toBe(3);
            done();
          });
        });
      });
    });

    it('With an empty collection', function (done) {
      d.remove({}, { multi: true }, function(err) {
        var cursor = new Cursor(d);
        cursor.exec(function (err, docs) {
          expect(err).toBeNull();
          expect(docs.length).toBe(0);
          done();
        });
      });
    });

    it('With a limit', function (done) {
      var cursor = new Cursor(d);
      cursor.limit(3);
      cursor.exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(3);
        done();
      });
    });

    it('With a skip', function (done) {
      var cursor = new Cursor(d);
      cursor.skip(2).exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(3);
        done();
      });
    });

    it('With a limit and a skip and method chaining', function (done) {
      var cursor = new Cursor(d);
      cursor.limit(4).skip(3);
      cursor.exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(2);
        done();
      });
    });
  });

  describe('Sorting of the results', function () {
    beforeEach(function (done) {
      d.insert({ age: 5 }, function (err) {
        d.insert({ age: 57 }, function (err) {
          d.insert({ age: 52 }, function (err) {
            d.insert({ age: 23 }, function (err) {
              d.insert({ age: 89 }, function (err) {
                return done();
              });
            });
          });
        });
      });
    });

    it('Using one sort', function (done) {
      var cursor = new Cursor(d, {});
      cursor.sort({ age: 1 });
      cursor.exec(function (err, docs) {
        expect(err).toBeNull();
        for (var i = 0; i < docs.length - 1; i += 1) {
          expect(docs[i].age < docs[i + 1].age).toBe(true);
        }

        cursor.sort({ age: -1 });
        cursor.exec(function (err, docs) {
          expect(err).toBeNull();
          for (var i = 0; i < docs.length - 1; i += 1) {
            expect(docs[i].age > docs[i + 1].age).toBe(true);
          }
          done();
        });
      });
    });

    it("Sorting strings with custom string comparison function", function (done) {
      var db = new Datastore({ inMemoryOnly: true, autoload: true
                             , compareStrings: function (a, b) { return a.length - b.length; }
                             });

      db.insert({ name: 'alpha' });
      db.insert({ name: 'charlie' });
      db.insert({ name: 'zulu' });

      db.find({}).sort({ name: 1 }).exec(function (err, docs) {
        expect(docs[0].name).toBe('zulu');
        expect(docs[1].name).toBe('alpha');
        expect(docs[2].name).toBe('charlie');

        delete db.compareStrings;
        db.find({}).sort({ name: 1 }).exec(function (err, docs) {
          expect(docs[0].name).toBe('alpha');
          expect(docs[1].name).toBe('charlie');
          expect(docs[2].name).toBe('zulu');
          done();
        });
      });
    });

    it('With an empty collection', function (done) {
      d.remove({}, { multi: true }, function(err) {
        var cursor = new Cursor(d);
        cursor.sort({ age: 1 });
        cursor.exec(function (err, docs) {
          expect(err).toBeNull();
          expect(docs.length).toBe(0);
          done();
        });
      });
    });

    it('Ability to chain sorting and exec', function (done) {
      var i;
      var cursor = new Cursor(d);
      cursor.sort({ age: 1 }).exec(function (err, docs) {
        expect(err).toBeNull();
        for (i = 0; i < docs.length - 1; i += 1) {
          expect(docs[i].age < docs[i + 1].age).toBe(true);
        }
        done();
      });
    });

    it('Using limit and sort', function (done) {
      var cursor = new Cursor(d);
      cursor.sort({ age: 1 }).limit(3).exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(3);
        expect(docs[0].age).toBe(5);
        expect(docs[1].age).toBe(23);
        expect(docs[2].age).toBe(52);
        done();
      });
    });

    it('Using a limit higher than total number of docs shouldnt cause an error', function (done) {
      var cursor = new Cursor(d);
      cursor.sort({ age: 1 }).limit(7).exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(5);
        expect(docs[0].age).toBe(5);
        expect(docs[1].age).toBe(23);
        expect(docs[2].age).toBe(52);
        expect(docs[3].age).toBe(57);
        expect(docs[4].age).toBe(89);
        done();
      });
    });

    it('Using limit and skip with sort', function (done) {
      var cursor = new Cursor(d);
      cursor.sort({ age: 1 }).limit(1).skip(2).exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(1);
        expect(docs[0].age).toBe(52);
        done();
      });
    });

    it('Using too big a skip with sort should return no result', function (done) {
      var cursor = new Cursor(d);
      cursor.sort({ age: 1 }).skip(5).exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(0);
        done();
      });
    });
  });

  describe('Projections', function () {
    var doc0, doc1, doc2, doc3, doc4;

    beforeEach(function (done) {
      d.insert({ age: 5, name: 'Jo', planet: 'B', toys: { bebe: true, ballon: 'much' } }, function (err, _doc0) {
        doc0 = _doc0;
        d.insert({ age: 57, name: 'Louis', planet: 'R', toys: { ballon: 'yeah', bebe: false } }, function (err, _doc1) {
          doc1 = _doc1;
          d.insert({ age: 52, name: 'Grafitti', planet: 'C', toys: { bebe: 'kind of' } }, function (err, _doc2) {
            doc2 = _doc2;
            d.insert({ age: 23, name: 'LM', planet: 'S' }, function (err, _doc3) {
              doc3 = _doc3;
              d.insert({ age: 89, planet: 'Earth' }, function (err, _doc4) {
                doc4 = _doc4;
                return done();
              });
            });
          });
        });
      });
    });

    it('Takes all results if no projection or empty object given', function (done) {
      var cursor = new Cursor(d, {});
      cursor.sort({ age: 1 });
      cursor.exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(5);
        done();
      });
    });

    it('Can take only the expected fields', function (done) {
      var cursor = new Cursor(d, {});
      cursor.sort({ age: 1 });
      cursor.projection({ age: 1, name: 1 });
      cursor.exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(5);
        expect(docs[0]).toEqual({ age: 5, name: 'Jo', _id: doc0._id });
        expect(docs[1]).toEqual({ age: 23, name: 'LM', _id: doc3._id });
        expect(docs[2]).toEqual({ age: 52, name: 'Grafitti', _id: doc2._id });
        expect(docs[3]).toEqual({ age: 57, name: 'Louis', _id: doc1._id });
        expect(docs[4]).toEqual({ age: 89, _id: doc4._id });
        done();
      });
    });

    it('Can omit only the expected fields', function (done) {
      var cursor = new Cursor(d, {});
      cursor.sort({ age: 1 });
      cursor.projection({ age: 0, name: 0 });
      cursor.exec(function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(5);
        expect(docs[0].planet).toBe('B');
        expect(docs[0].name).toBeUndefined();
        expect(docs[0].age).toBeUndefined();
        done();
      });
    });

    it('Cannot use both modes except for _id', function (done) {
      var cursor = new Cursor(d, {});
      cursor.sort({ age: 1 });
      cursor.projection({ age: 1, name: 0 });
      cursor.exec(function (err, docs) {
        expect(err).not.toBeNull();
        expect(docs).toBeUndefined();
        done();
      });
    });
  });
});