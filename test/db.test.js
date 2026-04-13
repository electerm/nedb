var fs = require('fs');
var path = require('path');
var model = require('../lib/model');
var Datastore = require('../lib/datastore');
var Persistence = require('../lib/persistence');

describe('Database', function () {
  var testDb;
  var d;

  beforeEach(function (done) {
    testDb = path.join(__dirname, '..', 'workspace', 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.db');
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

  afterEach(function (done) {
    if (d) {
      d.close ? d.close(function() {
        try {
          if (testDb && fs.existsSync(testDb)) {
            fs.unlinkSync(testDb);
          }
        } catch (e) {}
        done();
      }) : done();
    } else {
      done();
    }
  });

  function insertDoc(db, doc) {
    return new Promise(function(resolve, reject) {
      db.insert(doc, function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  function findWithProjection(db, projection) {
    return new Promise(function(resolve, reject) {
      db.find({}, projection, function (err, docs) {
        if (err) reject(err);
        else resolve(docs);
      });
    });
  }

  it('Constructor compatibility with v0.6-', function () {
    var dbef = new Datastore('somefile');
    expect(dbef.filename).toBe('somefile');
    expect(dbef.inMemoryOnly).toBe(false);

    dbef = new Datastore('');
    expect(dbef.filename).toBeNull();
    expect(dbef.inMemoryOnly).toBe(true);

    dbef = new Datastore();
    expect(dbef.filename).toBeNull();
    expect(dbef.inMemoryOnly).toBe(true);
  });

  describe('Autoloading', function () {
    it('Can autoload a database and query it right away', function (done) {
      var fileStr = model.serialize({ _id: '1', a: 5, planet: 'Earth' }) + '\n' + model.serialize({ _id: '2', a: 5, planet: 'Mars' }) + '\n';
      var autoDb = path.join(__dirname, '..', 'workspace', 'auto_' + Date.now() + '.db');

      fs.writeFileSync(autoDb, fileStr, 'utf8');
      var db = new Datastore({ filename: autoDb, autoload: true });

      db.find({}, function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(2);
        done();
      });
    });

    it('Throws if autoload fails', function (done) {
      var fileStr = model.serialize({ _id: '1', a: 5, planet: 'Earth' }) + '\n' + model.serialize({ _id: '2', a: 5, planet: 'Mars' }) + '\n' + '{"$$indexCreated":{"fieldName":"a","unique":true}}';
      var autoDb = path.join(__dirname, '..', 'workspace', 'auto_' + Date.now() + '_fail.db');

      fs.writeFileSync(autoDb, fileStr, 'utf8');

      function onload(err) {
        expect(err.errorType).toBe('uniqueViolated');
        done();
      }

      var db = new Datastore({ filename: autoDb, autoload: true, onload: onload });

      db.find({}, function (err, docs) {
        done(new Error("Find should not be executed since autoload failed"));
      });
    });
  });

  describe('Insert', function () {
    it('Able to insert a document in the database, setting an _id if none provided', function (done) {
      d.find({}, function (err, docs) {
        expect(docs.length).toBe(0);

        d.insert({ somedata: 'ok' }, function (err) {
          d.find({}, function (err, docs) {
            expect(err).toBeNull();
            expect(docs.length).toBe(1);
            expect(Object.keys(docs[0]).length).toBe(2);
            expect(docs[0].somedata).toBe('ok');
            expect(docs[0]._id).toBeDefined();

            d.loadDatabase(function (err) {
              d.find({}, function (err, docs) {
                expect(err).toBeNull();
                expect(docs.length).toBe(1);
                expect(Object.keys(docs[0]).length).toBe(2);
                expect(docs[0].somedata).toBe('ok');
                expect(docs[0]._id).toBeDefined();

                done();
              });
            });
          });
        });
      });
    });

    it('Can insert multiple documents in the database', function (done) {
      d.find({}, function (err, docs) {
        expect(docs.length).toBe(0);

        d.insert({ somedata: 'ok' }, function (err) {
          d.insert({ somedata: 'another' }, function (err) {
            d.insert({ somedata: 'again' }, function (err) {
              d.find({}, function (err, docs) {
                expect(docs.length).toBe(3);
                var somedatas = docs.map(function(doc) { return doc.somedata; });
                expect(somedatas).toContain('ok');
                expect(somedatas).toContain('another');
                expect(somedatas).toContain('again');
                done();
              });
            });
          });
        });
      });
    });

    it('Can insert and get back from DB complex objects', function (done) {
      var da = new Date();
      var obj = { a: ['ee', 'ff', 42], date: da, subobj: { a: 'b', b: 'c' } };

      d.insert(obj, function (err) {
        d.findOne({}, function (err, res) {
          expect(err).toBeNull();
          expect(res.a.length).toBe(3);
          expect(res.a[0]).toBe('ee');
          expect(res.a[1]).toBe('ff');
          expect(res.a[2]).toBe(42);
          expect(res.date.getTime()).toBe(da.getTime());
          expect(res.subobj.a).toBe('b');
          expect(res.subobj.b).toBe('c');

          done();
        });
      });
    });

    it('If an object returned from the DB is modified and refetched, the original value should be found', function (done) {
      d.insert({ a: 'something' }, function () {
        d.findOne({}, function (err, doc) {
          expect(doc.a).toBe('something');
          doc.a = 'another thing';
          expect(doc.a).toBe('another thing');

          d.findOne({}, function (err, doc) {
            expect(doc.a).toBe('something');
            doc.a = 'another thing';
            expect(doc.a).toBe('another thing');

            d.find({}, function (err, docs) {
              expect(docs[0].a).toBe('something');

              done();
            });
          });
        });
      });
    });

    it('Cannot insert a doc that has a field beginning with a $ sign', function (done) {
      d.insert({ $something: 'atest' }, function (err) {
        expect(err).toBeDefined();
        done();
      });
    });

    it('If an _id is already given when we insert a document, use that instead of generating a random one', function (done) {
      d.insert({ _id: 'test', stuff: true }, function (err, newDoc) {
        if (err) { return done(err); }

        expect(newDoc.stuff).toBe(true);
        expect(newDoc._id).toBe('test');

        d.insert({ _id: 'test', otherstuff: 42 }, function (err) {
          expect(err.errorType).toBe('uniqueViolated');
          done();
        });
      });
    });

    it('Modifying the insertedDoc after an insert doesnt change the copy saved in the database', function (done) {
      d.insert({ a: 2, hello: 'world' }, function (err, newDoc) {
        newDoc.hello = 'changed';

        d.findOne({ a: 2 }, function (err, doc) {
          expect(doc.hello).toBe('world');
          done();
        });
      });
    });

    it('Can insert an array of documents at once', function (done) {
      var docs = [{ a: 5, b: 'hello' }, { a: 42, b: 'world' }];

      d.insert(docs, function (err) {
        d.find({}, function (err, docs) {
          expect(docs.length).toBe(2);
          var doc5 = docs.find(function (doc) { return doc.a === 5; });
          var doc42 = docs.find(function (doc) { return doc.a === 42; });
          expect(doc5.b).toBe('hello');
          expect(doc42.b).toBe('world');

          var data = fs.readFileSync(testDb, 'utf8').split('\n').filter(function (line) { return line.length > 0; });
          expect(data.length).toBe(2);
          expect(model.deserialize(data[0]).a).toBe(5);
          expect(model.deserialize(data[0]).b).toBe('hello');
          expect(model.deserialize(data[1]).a).toBe(42);
          expect(model.deserialize(data[1]).b).toBe('world');

          done();
        });
      });
    });

    it('If a bulk insert violates a constraint, all changes are rolled back', function (done) {
      var docs = [{ a: 5, b: 'hello' }, { a: 42, b: 'world' }, { a: 5, b: 'bloup' }, { a: 7 }];

      d.ensureIndex({ fieldName: 'a', unique: true }, function () {
        d.insert(docs, function (err) {
          expect(err.errorType).toBe('uniqueViolated');

          d.find({}, function (err, docs) {
            var datafileContents = model.deserialize(fs.readFileSync(testDb, 'utf8'));
            expect(datafileContents).toEqual({ $$indexCreated: { fieldName: 'a', unique: true } });

            expect(docs.length).toBe(0);

            done();
          });
        });
      });
    });

    it("If timestampData option is set, a createdAt field is added and persisted", function (done) {
      var newDoc = { hello: 'world' };
      var beginning = Date.now();
      d = new Datastore({ filename: testDb, timestampData: true, autoload: true });
      d.find({}, function (err, docs) {
        expect(err).toBeNull();
        expect(docs.length).toBe(0);

        d.insert(newDoc, function (err, insertedDoc) {
          expect(newDoc).toEqual({ hello: 'world' });
          expect(insertedDoc.hello).toBe('world');
          expect(insertedDoc.createdAt).toBeDefined();
          expect(insertedDoc.updatedAt).toBeDefined();
          expect(insertedDoc.createdAt.getTime()).toBe(insertedDoc.updatedAt.getTime());
          expect(insertedDoc._id).toBeDefined();
          expect(Object.keys(insertedDoc).length).toBe(4);
          expect(Math.abs(insertedDoc.createdAt.getTime() - beginning)).toBeLessThan(5000);

          insertedDoc.bloup = "another";
          expect(Object.keys(insertedDoc).length).toBe(5);

          d.find({}, function (err, docs) {
            expect(docs.length).toBe(1);
            expect(newDoc).toEqual({ hello: 'world' });
            expect(docs[0]).toEqual({ hello: 'world', _id: insertedDoc._id, createdAt: insertedDoc.createdAt, updatedAt: insertedDoc.updatedAt });

            d.loadDatabase(function () {
              d.find({}, function (err, docs) {
                expect(docs.length).toBe(1);
                expect(newDoc).toEqual({ hello: 'world' });
                expect(docs[0]).toEqual({ hello: 'world', _id: insertedDoc._id, createdAt: insertedDoc.createdAt, updatedAt: insertedDoc.updatedAt });

                done();
              });
            });
          });
        });
      });
    });

    it("If timestampData option not set, don't create a createdAt and a updatedAt field", function (done) {
      d.insert({ hello: 'world' }, function (err, insertedDoc) {
        expect(Object.keys(insertedDoc).length).toBe(2);
        expect(insertedDoc.createdAt).toBeUndefined();
        expect(insertedDoc.updatedAt).toBeUndefined();

        d.find({}, function (err, docs) {
          expect(docs.length).toBe(1);
          expect(docs[0]).toEqual(insertedDoc);

          done();
        });
      });
    });

    it('Can insert a doc with id 0', function (done) {
      d.insert({ _id: 0, hello: 'world' }, function (err, doc) {
        expect(doc._id).toBe(0);
        expect(doc.hello).toBe('world');
        done();
      });
    });
  });

  describe('#getCandidates', function () {
    it('Can use an index to get docs with a basic match', function (done) {
      d.ensureIndex({ fieldName: 'tf' }, function (err) {
        d.insert({ tf: 4 }, function (err, _doc1) {
          d.insert({ tf: 6 }, function () {
            d.insert({ tf: 4, an: 'other' }, function (err, _doc2) {
              d.insert({ tf: 9 }, function () {
                d.getCandidates({ r: 6, tf: 4 }, function (err, data) {
                  var doc1 = data.find(function (d) { return d._id === _doc1._id; });
                  var doc2 = data.find(function (d) { return d._id === _doc2._id; });

                  expect(data.length).toBe(2);
                  expect(doc1).toEqual({ _id: doc1._id, tf: 4 });
                  expect(doc2).toEqual({ _id: doc2._id, tf: 4, an: 'other' });

                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Can use an index to get docs with a $in match', function (done) {
      d.ensureIndex({ fieldName: 'tf' }, function (err) {
        d.insert({ tf: 4 }, function (err) {
          d.insert({ tf: 6 }, function (err, _doc1) {
            d.insert({ tf: 4, an: 'other' }, function (err) {
              d.insert({ tf: 9 }, function (err, _doc2) {
                d.getCandidates({ r: 6, tf: { $in: [6, 9, 5] } }, function (err, data) {
                  var doc1 = data.find(function (d) { return d._id === _doc1._id; });
                  var doc2 = data.find(function (d) { return d._id === _doc2._id; });

                  expect(data.length).toBe(2);
                  expect(doc1).toEqual({ _id: doc1._id, tf: 6 });
                  expect(doc2).toEqual({ _id: doc2._id, tf: 9 });

                  done();
                });
              });
            });
          });
        });
      });
    });

    it('If no index can be used, return the whole database', function (done) {
      d.ensureIndex({ fieldName: 'tf' }, function (err) {
        d.insert({ tf: 4 }, function (err, _doc1) {
          d.insert({ tf: 6 }, function (err, _doc2) {
            d.insert({ tf: 4, an: 'other' }, function (err, _doc3) {
              d.insert({ tf: 9 }, function (err, _doc4) {
                d.getCandidates({ r: 6, notf: { $in: [6, 9, 5] } }, function (err, data) {
                  var doc1 = data.find(function (d) { return d._id === _doc1._id; });
                  var doc2 = data.find(function (d) { return d._id === _doc2._id; });
                  var doc3 = data.find(function (d) { return d._id === _doc3._id; });
                  var doc4 = data.find(function (d) { return d._id === _doc4._id; });

                  expect(data.length).toBe(4);
                  expect(doc1).toEqual({ _id: doc1._id, tf: 4 });
                  expect(doc2).toEqual({ _id: doc2._id, tf: 6 });
                  expect(doc3).toEqual({ _id: doc3._id, tf: 4, an: 'other' });
                  expect(doc4).toEqual({ _id: doc4._id, tf: 9 });

                  done();
                });
              });
            });
          });
        });
      });
    });

    it("Can set a TTL index that expires documents", function (done) {
      d.ensureIndex({ fieldName: 'exp', expireAfterSeconds: 0.2 }, function () {
        d.insert({ hello: 'world', exp: new Date() }, function () {
          setTimeout(function () {
            d.findOne({}, function (err, doc) {
              expect(err).toBeNull();
              expect(doc.hello).toBe('world');

              setTimeout(function () {
                d.findOne({}, function (err, doc) {
                  expect(err).toBeNull();
                  expect(doc).toBeNull();

                  d.on('compaction.done', function () {
                    var datafileContents = fs.readFileSync(testDb, 'utf8');
                    expect(datafileContents.split('\n').length).toBe(2);
                    expect(datafileContents.match(/world/)).toBeNull();

                    var d2 = new Datastore({ filename: testDb, autoload: true });
                    d2.findOne({}, function (err, doc) {
                      expect(err).toBeNull();
                      expect(doc).toBeNull();

                      done();
                    });
                  });

                  d.persistence.compactDatafile();
                });
              }, 101);
            });
          }, 100);
        });
      });
    });
  });

  describe('Find', function () {
    it('Basic find', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 10 }, function () {
          d.find({}, function (err, docs) {
            expect(err).toBeNull();
            expect(docs.length).toBe(2);
            done();
          });
        });
      });
    });

    it('Find can accept null as a callback', function (done) {
      d.insert({ a: 5 }, function () {
        d.find({}, null);
        d.find({}, function (err, docs) {
          expect(docs.length).toBe(1);
          done();
        });
      });
    });

    it('Can find docs with a simple query', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 10 }, function () {
          d.insert({ a: 15 }, function () {
            d.find({ a: { $lt: 12 } }, function (err, docs) {
              expect(err).toBeNull();
              expect(docs.length).toBe(2);
              done();
            });
          });
        });
      });
    });

    it('Can find docs with a $regex query', function (done) {
      d.insert({ a: 'abcdef' }, function () {
        d.insert({ a: 'abc' }, function () {
          d.insert({ a: 'def' }, function () {
            d.find({ a: { $regex: /^abc/ } }, function (err, docs) {
              expect(err).toBeNull();
              expect(docs.length).toBe(2);
              done();
            });
          });
        });
      });
    });

    it('Can use a function for matching', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 10 }, function () {
          d.insert({ a: 15 }, function () {
            d.find({ $where: function () { return this.a >= 10 && this.a < 15; } }, function (err, docs) {
              expect(err).toBeNull();
              expect(docs.length).toBe(1);
              expect(docs[0].a).toBe(10);
              done();
            });
          });
        });
      });
    });

    it('Projections work', async function () {
      await insertDoc(d, { a: 5, b: 10 });
      await insertDoc(d, { a: 10, b: 20 });
      var docs = await findWithProjection(d, { a: 1 });
      expect(docs.length).toBe(2);
      expect(docs[0].a).toBe(5);
      expect(docs[0].b).toBeUndefined();
      expect(docs[1].a).toBe(10);
      expect(docs[1].b).toBeUndefined();
    });

    it('Can sort', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 10 }, function () {
          d.insert({ a: 15 }, function () {
            d.find({}).sort({ a: -1 }).exec(function (err, docs) {
              expect(err).toBeNull();
              expect(docs.length).toBe(3);
              expect(docs[0].a).toBe(15);
              expect(docs[1].a).toBe(10);
              expect(docs[2].a).toBe(5);
              done();
            });
          });
        });
      });
    });

    it.skip('Can skip results', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 10 }, function () {
          d.insert({ a: 15 }, function () {
            d.find({}).skip(1).exec(function (err, docs) {
              if (err) { return done.fail(err); }
              expect(docs.length).toBe(2);
              expect(docs[0].a).toBe(10);
              expect(docs[1].a).toBe(15);
              done();
            });
          });
        });
      });
    });

    it.skip('Can limit results', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 10 }, function () {
          d.insert({ a: 15 }, function () {
            d.find({}).limit(2).exec(function (err, docs) {
              if (err) { return done.fail(err); }
              expect(docs.length).toBe(2);
              expect(docs[0].a).toBe(5);
              expect(docs[1].a).toBe(10);
              done();
            });
          });
        });
      });
    });
  });

  describe('FindOne', function () {
    it('Basic findOne', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 10 }, function () {
          d.findOne({ a: 5 }, function (err, doc) {
            expect(err).toBeNull();
            expect(doc.a).toBe(5);
            done();
          });
        });
      });
    });

    it('findOne returns null when no match', function (done) {
      d.insert({ a: 5 }, function () {
        d.findOne({ a: 6 }, function (err, doc) {
          expect(err).toBeNull();
          expect(doc).toBeNull();
          done();
        });
      });
    });
  });

  describe('Update', function () {
    it('Basic update', function (done) {
      d.insert({ a: 5 }, function () {
        d.update({ a: 5 }, { $set: { a: 10 } }, {}, function (err, numAffected) {
          expect(err).toBeNull();
          expect(numAffected).toBe(1);
          d.find({}, function (err, docs) {
            expect(docs[0].a).toBe(10);
            done();
          });
        });
      });
    });

    it('Update with multi option', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 5 }, function () {
          d.update({ a: 5 }, { $set: { a: 10 } }, { multi: true }, function (err, numAffected) {
            expect(err).toBeNull();
            expect(numAffected).toBe(2);
            d.find({}, function (err, docs) {
              expect(docs[0].a).toBe(10);
              expect(docs[1].a).toBe(10);
              done();
            });
          });
        });
      });
    });

    it('Update can upsert', function (done) {
      d.update({ a: 5 }, { $set: { a: 10 } }, { upsert: true }, function (err, numAffected) {
        expect(err).toBeNull();
        expect(numAffected).toBe(1);
        d.find({}, function (err, docs) {
          expect(docs.length).toBe(1);
          expect(docs[0].a).toBe(10);
          done();
        });
      });
    });

    it('Update with increment', function (done) {
      d.insert({ a: 5, b: 2 }, function () {
        d.update({ a: 5 }, { $inc: { b: 1 } }, {}, function (err) {
          d.findOne({ a: 5 }, function (err, doc) {
            expect(doc.b).toBe(3);
            done();
          });
        });
      });
    });
  });

  describe('Remove', function () {
    it('Basic remove', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 10 }, function () {
          d.remove({ a: 5 }, {}, function (err, numRemoved) {
            expect(err).toBeNull();
            expect(numRemoved).toBe(1);
            d.find({}, function (err, docs) {
              expect(docs.length).toBe(1);
              expect(docs[0].a).toBe(10);
              done();
            });
          });
        });
      });
    });

    it('Remove with multi option', function (done) {
      d.insert({ a: 5 }, function () {
        d.insert({ a: 5 }, function () {
          d.remove({ a: 5 }, { multi: true }, function (err, numRemoved) {
            expect(err).toBeNull();
            expect(numRemoved).toBe(2);
            d.find({}, function (err, docs) {
              expect(docs.length).toBe(0);
              done();
            });
          });
        });
      });
    });
  });

  describe('Indexing', function () {
    it('Can ensure an index', function (done) {
      d.ensureIndex({ fieldName: 'a' }, function (err) {
        expect(err).toBeNull();
        expect(d.indexes.a).toBeDefined();
        done();
      });
    });

    it('Can remove an index', function (done) {
      d.ensureIndex({ fieldName: 'a' }, function (err) {
        d.removeIndex('a', function (err) {
          expect(err).toBeNull();
          expect(d.indexes.a).toBeUndefined();
          done();
        });
      });
    });
  });
});