var testDb = 'workspace/test.db';
var fs = require('fs');
var path = require('path');
var model = require('../lib/model');
var Datastore = require('../lib/datastore');
var Persistence = require('../lib/persistence');
var storage = require('../lib/storage');
var child_process = require('child_process');

describe('Persistence', function () {
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

  it('Every line represents a document', function () {
    var now = new Date();
    var rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
    model.serialize({ _id: "2", hello: 'world' }) + '\n' +
    model.serialize({ _id: "3", nested: { today: now } });
    var treatedData = d.persistence.treatRawData(rawData).data;

    treatedData.sort(function (a, b) { return a._id - b._id; });
    expect(treatedData.length).toBe(3);
    expect(treatedData[0]).toEqual({ _id: "1", a: 2, ages: [1, 5, 12] });
    expect(treatedData[1]).toEqual({ _id: "2", hello: 'world' });
    expect(treatedData[2]).toEqual({ _id: "3", nested: { today: now } });
  });

  it('Badly formatted lines have no impact on the treated data', function () {
    var now = new Date();
    var rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
    'garbage\n' +
    model.serialize({ _id: "3", nested: { today: now } });
    var treatedData = d.persistence.treatRawData(rawData).data;

    treatedData.sort(function (a, b) { return a._id - b._id; });
    expect(treatedData.length).toBe(2);
    expect(treatedData[0]).toEqual({ _id: "1", a: 2, ages: [1, 5, 12] });
    expect(treatedData[1]).toEqual({ _id: "3", nested: { today: now } });
  });

  it('Well formatted lines that have no _id are not included in the data', function () {
    var now = new Date();
    var rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
    model.serialize({ _id: "2", hello: 'world' }) + '\n' +
    model.serialize({ nested: { today: now } });
    var treatedData = d.persistence.treatRawData(rawData).data;

    treatedData.sort(function (a, b) { return a._id - b._id; });
    expect(treatedData.length).toBe(2);
    expect(treatedData[0]).toEqual({ _id: "1", a: 2, ages: [1, 5, 12] });
    expect(treatedData[1]).toEqual({ _id: "2", hello: 'world' });
  });

  it('If two lines concern the same doc (= same _id), the last one is the good version', function () {
    var now = new Date();
    var rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
    model.serialize({ _id: "2", hello: 'world' }) + '\n' +
    model.serialize({ _id: "1", nested: { today: now } });
    var treatedData = d.persistence.treatRawData(rawData).data;

    treatedData.sort(function (a, b) { return a._id - b._id; });
    expect(treatedData.length).toBe(2);
    expect(treatedData[0]).toEqual({ _id: "1", nested: { today: now } });
    expect(treatedData[1]).toEqual({ _id: "2", hello: 'world' });
  });

  it('If a doc contains $$deleted: true, that means we need to remove it from the data', function () {
    var now = new Date();
    var rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
    model.serialize({ _id: "2", hello: 'world' }) + '\n' +
    model.serialize({ _id: "1", $$deleted: true }) + '\n' +
    model.serialize({ _id: "3", today: now });
    var treatedData = d.persistence.treatRawData(rawData).data;

    treatedData.sort(function (a, b) { return a._id - b._id; });
    expect(treatedData.length).toBe(2);
    expect(treatedData[0]).toEqual({ _id: "2", hello: 'world' });
    expect(treatedData[1]).toEqual({ _id: "3", today: now });
  });

  it('If a doc contains $$deleted: true, no error is thrown if the doc wasnt in the list before', function () {
    var now = new Date();
    var rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
    model.serialize({ _id: "2", $$deleted: true }) + '\n' +
    model.serialize({ _id: "3", today: now });
    var treatedData = d.persistence.treatRawData(rawData).data;

    treatedData.sort(function (a, b) { return a._id - b._id; });
    expect(treatedData.length).toBe(2);
    expect(treatedData[0]).toEqual({ _id: "1", a: 2, ages: [1, 5, 12] });
    expect(treatedData[1]).toEqual({ _id: "3", today: now });
  });

  it('If a doc contains $$indexCreated, no error is thrown during treatRawData and we can get the index options', function () {
    var now = new Date();
    var rawData = model.serialize({ _id: "1", a: 2, ages: [1, 5, 12] }) + '\n' +
    model.serialize({ $$indexCreated: { fieldName: "test", unique: true } }) + '\n' +
    model.serialize({ _id: "3", today: now });
    var treatedData = d.persistence.treatRawData(rawData).data;
    var indexes = d.persistence.treatRawData(rawData).indexes;

    expect(Object.keys(indexes).length).toBe(1);
    expect(indexes.test).toEqual({ fieldName: "test", unique: true });

    treatedData.sort(function (a, b) { return a._id - b._id; });
    expect(treatedData.length).toBe(2);
    expect(treatedData[0]).toEqual({ _id: "1", a: 2, ages: [1, 5, 12] });
    expect(treatedData[1]).toEqual({ _id: "3", today: now });
  });

  it('Compact database on load', function (done) {
    d.insert({ a: 2 }, function () {
      d.insert({ a: 4 }, function () {
        d.remove({ a: 2 }, {}, function () {
          var data = fs.readFileSync(d.filename, 'utf8').split('\n');
          var filledCount = 0;
          data.forEach(function (item) { if (item.length > 0) { filledCount += 1; } });
          expect(filledCount).toBe(3);

          d.loadDatabase(function (err) {
            expect(err).toBeNull();

            var data = fs.readFileSync(d.filename, 'utf8').split('\n');
            var filledCount = 0;
            data.forEach(function (item) { if (item.length > 0) { filledCount += 1; } });
            expect(filledCount).toBe(1);

            done();
          });
        });
      });
    });
  });

  it('Calling loadDatabase after the data was modified doesnt change its contents', function (done) {
    d.loadDatabase(function () {
      d.insert({ a: 1 }, function (err) {
        expect(err).toBeNull();
        d.insert({ a: 2 }, function (err) {
          var data = d.getAllData();
          var doc1 = data.find(function (doc) { return doc.a === 1; });
          var doc2 = data.find(function (doc) { return doc.a === 2; });
          expect(err).toBeNull();
          expect(data.length).toBe(2);
          expect(doc1.a).toBe(1);
          expect(doc2.a).toBe(2);

          d.loadDatabase(function (err) {
            var data = d.getAllData();
            var doc1 = data.find(function (doc) { return doc.a === 1; });
            var doc2 = data.find(function (doc) { return doc.a === 2; });
            expect(err).toBeNull();
            expect(data.length).toBe(2);
            expect(doc1.a).toBe(1);
            expect(doc2.a).toBe(2);

            done();
          });
        });
      });
    });
  });

  it('Calling loadDatabase after the datafile was removed will reset the database', function (done) {
    d.loadDatabase(function () {
      d.insert({ a: 1 }, function (err) {
        expect(err).toBeNull();
        d.insert({ a: 2 }, function (err) {
          var data = d.getAllData();
          var doc1 = data.find(function (doc) { return doc.a === 1; });
          var doc2 = data.find(function (doc) { return doc.a === 2; });
          expect(err).toBeNull();
          expect(data.length).toBe(2);
          expect(doc1.a).toBe(1);
          expect(doc2.a).toBe(2);

          fs.unlink(testDb, function (err) {
            expect(err).toBeNull();
            d.loadDatabase(function (err) {
              expect(err).toBeNull();
              expect(d.getAllData().length).toBe(0);

              done();
            });
          });
        });
      });
    });
  });

  it('Calling loadDatabase after the datafile was modified loads the new data', function (done) {
    d.loadDatabase(function () {
      d.insert({ a: 1 }, function (err) {
        expect(err).toBeNull();
        d.insert({ a: 2 }, function (err) {
          var data = d.getAllData();
          var doc1 = data.find(function (doc) { return doc.a === 1; });
          var doc2 = data.find(function (doc) { return doc.a === 2; });
          expect(err).toBeNull();
          expect(data.length).toBe(2);
          expect(doc1.a).toBe(1);
          expect(doc2.a).toBe(2);

          fs.writeFile(testDb, '{"a":3,"_id":"aaa"}', 'utf8', function (err) {
            expect(err).toBeNull();
            d.loadDatabase(function (err) {
              var data = d.getAllData();
              var doc1 = data.find(function (doc) { return doc.a === 1; });
              var doc2 = data.find(function (doc) { return doc.a === 2; });
              var doc3 = data.find(function (doc) { return doc.a === 3; });
              expect(err).toBeNull();
              expect(data.length).toBe(1);
              expect(doc3.a).toBe(3);
              expect(doc1).toBeUndefined();
              expect(doc2).toBeUndefined();

              done();
            });
          });
        });
      });
    });
  });

  it("When treating raw data, refuse to proceed if too much data is corrupt, to avoid data loss", function (done) {
    var corruptTestFilename = 'workspace/corruptTest.db';
    var fakeData = '{"_id":"one","hello":"world"}\n' + 'Some corrupt data\n' + '{"_id":"two","hello":"earth"}\n' + '{"_id":"three","hello":"you"}\n';
    var d;
    fs.writeFileSync(corruptTestFilename, fakeData, "utf8");

    d = new Datastore({ filename: corruptTestFilename });
    d.loadDatabase(function (err) {
      expect(err).toBeDefined();
      expect(err).not.toBeNull();

      fs.writeFileSync(corruptTestFilename, fakeData, "utf8");
      d = new Datastore({ filename: corruptTestFilename, corruptAlertThreshold: 1 });
      d.loadDatabase(function (err) {
        expect(err).toBeNull();

        fs.writeFileSync(corruptTestFilename, fakeData, "utf8");
        d = new Datastore({ filename: corruptTestFilename, corruptAlertThreshold: 0 });
        d.loadDatabase(function (err) {
          expect(err).toBeDefined();
          expect(err).not.toBeNull();

          done();
        });
      });
    });
  });

  it("Can listen to compaction events", function (done) {
    d.on('compaction.done', function () {
      d.removeAllListeners('compaction.done');
      done();
    });

    d.persistence.compactDatafile();
  });

  describe('Serialization hooks', function () {
    var as = function (s) { return "before_" + s + "_after"; };
    var bd = function (s) { return s.substring(7, s.length - 6); };

    it("Declaring only one hook will throw an exception to prevent data loss", function (done) {
      var hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        fs.writeFileSync(hookTestFilename, "Some content", "utf8");

        expect(function () {
          new Datastore({ filename: hookTestFilename, autoload: true
                        , afterSerialization: as
          });
        }).toThrow();

        expect(fs.readFileSync(hookTestFilename, "utf8")).toBe("Some content");

        expect(function () {
          new Datastore({ filename: hookTestFilename, autoload: true
                        , beforeDeserialization: bd
          });
        }).toThrow();

        expect(fs.readFileSync(hookTestFilename, "utf8")).toBe("Some content");

        done();
      });
    });

    it("Declaring two hooks that are not reverse of one another will cause an exception to prevent data loss", function (done) {
      var hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        fs.writeFileSync(hookTestFilename, "Some content", "utf8");

        expect(function () {
          new Datastore({ filename: hookTestFilename, autoload: true
                        , afterSerialization: as
                        , beforeDeserialization: function (s) { return s; }
          });
        }).toThrow();

        expect(fs.readFileSync(hookTestFilename, "utf8")).toBe("Some content");

        done();
      });
    });

    it("A serialization hook can be used to transform data before writing new state to disk", function (done) {
      var hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        var d = new Datastore({ filename: hookTestFilename, autoload: true
          , afterSerialization: as
          , beforeDeserialization: bd
        });

        d.insert({ hello: "world" }, function () {
          var _data = fs.readFileSync(hookTestFilename, 'utf8');
          var data = _data.split('\n');
          var doc0 = bd(data[0]);

          expect(data.length).toBe(2);

          expect(data[0].substring(0, 7)).toBe('before_');
          expect(data[0].substring(data[0].length - 6)).toBe('_after');

          doc0 = model.deserialize(doc0);
          expect(Object.keys(doc0).length).toBe(2);
          expect(doc0.hello).toBe('world');

          d.insert({ p: 'Mars' }, function () {
            var _data = fs.readFileSync(hookTestFilename, 'utf8');
            var data = _data.split('\n');
            var doc0 = bd(data[0]);
            var doc1 = bd(data[1]);

            expect(data.length).toBe(3);

            expect(data[0].substring(0, 7)).toBe('before_');
            expect(data[0].substring(data[0].length - 6)).toBe('_after');
            expect(data[1].substring(0, 7)).toBe('before_');
            expect(data[1].substring(data[1].length - 6)).toBe('_after');

            doc0 = model.deserialize(doc0);
            expect(Object.keys(doc0).length).toBe(2);
            expect(doc0.hello).toBe('world');

            doc1 = model.deserialize(doc1);
            expect(Object.keys(doc1).length).toBe(2);
            expect(doc1.p).toBe('Mars');

            d.ensureIndex({ fieldName: 'idefix' }, function () {
              var _data = fs.readFileSync(hookTestFilename, 'utf8');
              var data = _data.split('\n');
              var doc0 = bd(data[0]);
              var doc1 = bd(data[1]);
              var idx = bd(data[2]);

              expect(data.length).toBe(4);

              expect(data[0].substring(0, 7)).toBe('before_');
              expect(data[0].substring(data[0].length - 6)).toBe('_after');
              expect(data[1].substring(0, 7)).toBe('before_');
              expect(data[1].substring(data[1].length - 6)).toBe('_after');

              doc0 = model.deserialize(doc0);
              expect(Object.keys(doc0).length).toBe(2);
              expect(doc0.hello).toBe('world');

              doc1 = model.deserialize(doc1);
              expect(Object.keys(doc1).length).toBe(2);
              expect(doc1.p).toBe('Mars');

              idx = model.deserialize(idx);
              expect(idx).toEqual({ '$$indexCreated': { fieldName: 'idefix' } });

              done();
            });
          });
        });
      });
    });

    it.skip("Use serialization hook when persisting cached database or compacting", function (done) {
      var hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        var d = new Datastore({ filename: hookTestFilename, autoload: true
          , afterSerialization: as
          , beforeDeserialization: bd
        });

        d.insert({ hello: "world" }, function () {
          d.update({ hello: "world" }, { $set: { hello: "earth" } }, {}, function () {
            d.ensureIndex({ fieldName: 'idefix' }, function () {
              var _data = fs.readFileSync(hookTestFilename, 'utf8');
              var data = _data.split('\n');
              var doc0 = bd(data[0]);
              var doc1 = bd(data[1]);
              var idx = bd(data[2]);
              var _id;

              expect(data.length).toBe(4);

              doc0 = model.deserialize(doc0);
              expect(Object.keys(doc0).length).toBe(2);
              expect(doc0.hello).toBe('world');

              doc1 = model.deserialize(doc1);
              expect(Object.keys(doc1).length).toBe(2);
              expect(doc1.hello).toBe('earth');

              expect(doc0._id).toBe(doc1._id);
              _id = doc0._id;

              idx = model.deserialize(idx);
              expect(idx).toEqual({ '$$indexCreated': { fieldName: 'idefix', unique: false, sparse: false } });

              d.persistence.persistCachedDatabase(function () {
                var _data = fs.readFileSync(hookTestFilename, 'utf8');
                var data = _data.split('\n');
                var doc0 = bd(data[0]);
                var idx = bd(data[1]);

                expect(data.length).toBe(3);

                doc0 = model.deserialize(doc0);
                expect(Object.keys(doc0).length).toBe(2);
                expect(doc0.hello).toBe('earth');

                expect(doc0._id).toBe(_id);

                idx = model.deserialize(idx);
                expect(idx).toEqual({ '$$indexCreated': { fieldName: 'idefix', unique: false, sparse: false } });

                done();
              });
            });
          });
        });
      });
    });

    it("Deserialization hook is correctly used when loading data", function (done) {
      var hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, function () {
        var d = new Datastore({ filename: hookTestFilename, autoload: true
          , afterSerialization: as
          , beforeDeserialization: bd
        });

        d.insert({ hello: "world" }, function (err, doc) {
          var _id = doc._id;
          d.insert({ yo: "ya" }, function () {
            d.update({ hello: "world" }, { $set: { hello: "earth" } }, {}, function () {
              d.remove({ yo: "ya" }, {}, function () {
                d.ensureIndex({ fieldName: 'idefix' }, function () {
                  var _data = fs.readFileSync(hookTestFilename, 'utf8');
                  var data = _data.split('\n');

                  expect(data.length).toBe(6);

                  var d2 = new Datastore({ filename: hookTestFilename
                    , afterSerialization: as
                    , beforeDeserialization: bd
                  });
                  d2.loadDatabase(function () {
                    d2.find({}, function (err, docs) {
                      expect(docs.length).toBe(1);
                      expect(docs[0].hello).toBe("earth");
                      expect(docs[0]._id).toBe(_id);

                      expect(Object.keys(d2.indexes).length).toBe(2);
                      expect(Object.keys(d2.indexes).indexOf("idefix")).not.toBe(-1);

                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Prevent dataloss when persisting data', function () {
    it('Creating a datastore with in memory as true and a bad filename wont cause an error', function () {
      new Datastore({ filename: 'workspace/bad.db~', inMemoryOnly: true });
    });

    it('Creating a persistent datastore with a bad filename will cause an error', function () {
      expect(function () { new Datastore({ filename: 'workspace/bad.db~' }); }).toThrow();
    });

    it('If no file exists, ensureDatafileIntegrity creates an empty datafile', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });

      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~'); }

      expect(fs.existsSync('workspace/it.db')).toBe(false);
      expect(fs.existsSync('workspace/it.db~')).toBe(false);

      storage.ensureDatafileIntegrity(p.filename, function (err) {
        expect(err).toBeNull();

        expect(fs.existsSync('workspace/it.db')).toBe(true);
        expect(fs.existsSync('workspace/it.db~')).toBe(false);

        expect(fs.readFileSync('workspace/it.db', 'utf8')).toBe('');

        done();
      });
    });

    it('If only datafile exists, ensureDatafileIntegrity will use it', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });

      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~'); }

      fs.writeFileSync('workspace/it.db', 'something', 'utf8');

      expect(fs.existsSync('workspace/it.db')).toBe(true);
      expect(fs.existsSync('workspace/it.db~')).toBe(false);

      storage.ensureDatafileIntegrity(p.filename, function (err) {
        expect(err).toBeNull();

        expect(fs.existsSync('workspace/it.db')).toBe(true);
        expect(fs.existsSync('workspace/it.db~')).toBe(false);

        expect(fs.readFileSync('workspace/it.db', 'utf8')).toBe('something');

        done();
      });
    });

    it('If temp datafile exists and datafile doesnt, ensureDatafileIntegrity will use it', function (done) {
      var p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });

      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~~'); }

      fs.writeFileSync('workspace/it.db~', 'something', 'utf8');

      expect(fs.existsSync('workspace/it.db')).toBe(false);
      expect(fs.existsSync('workspace/it.db~')).toBe(true);

      storage.ensureDatafileIntegrity(p.filename, function (err) {
        expect(err).toBeNull();

        expect(fs.existsSync('workspace/it.db')).toBe(true);
        expect(fs.existsSync('workspace/it.db~')).toBe(false);

        expect(fs.readFileSync('workspace/it.db', 'utf8')).toBe('something');

        done();
      });
    });

    it('If both temp and current datafiles exist, ensureDatafileIntegrity will use the datafile', function (done) {
      var theDb = new Datastore({ filename: 'workspace/it.db' });

      if (fs.existsSync('workspace/it.db')) { fs.unlinkSync('workspace/it.db'); }
      if (fs.existsSync('workspace/it.db~')) { fs.unlinkSync('workspace/it.db~'); }

      fs.writeFileSync('workspace/it.db', '{"_id":"0","hello":"world"}', 'utf8');
      fs.writeFileSync('workspace/it.db~', '{"_id":"0","hello":"other"}', 'utf8');

      expect(fs.existsSync('workspace/it.db')).toBe(true);
      expect(fs.existsSync('workspace/it.db~')).toBe(true);

      storage.ensureDatafileIntegrity(theDb.persistence.filename, function (err) {
        expect(err).toBeNull();

        expect(fs.existsSync('workspace/it.db')).toBe(true);
        expect(fs.existsSync('workspace/it.db~')).toBe(true);

        expect(fs.readFileSync('workspace/it.db', 'utf8')).toBe('{"_id":"0","hello":"world"}');

        theDb.loadDatabase(function (err) {
          expect(err).toBeNull();
          theDb.find({}, function (err, docs) {
            expect(err).toBeNull();
            expect(docs.length).toBe(1);
            expect(docs[0].hello).toBe("world");
            expect(fs.existsSync('workspace/it.db')).toBe(true);
            expect(fs.existsSync('workspace/it.db~')).toBe(false);
            done();
          });
        });
      });
    });

    it('persistCachedDatabase should update the contents of the datafile and leave a clean state', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.find({}, function (err, docs) {
          expect(docs.length).toBe(1);

          if (fs.existsSync(testDb)) { fs.unlinkSync(testDb); }
          if (fs.existsSync(testDb + '~')) { fs.unlinkSync(testDb + '~'); }
          expect(fs.existsSync(testDb)).toBe(false);

          fs.writeFileSync(testDb + '~', 'something', 'utf8');
          expect(fs.existsSync(testDb + '~')).toBe(true);

          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            expect(err).toBeNull();
            expect(fs.existsSync(testDb)).toBe(true);
            expect(fs.existsSync(testDb + '~')).toBe(false);
            expect(contents).toMatch(/^{\"hello\":\"world\",\"_id\":\"[0-9a-zA-Z]{16}\"}\n$/);
            done();
          });
        });
      });
    });

    it('After a persistCachedDatabase, there should be no temp or old filename', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.find({}, function (err, docs) {
          expect(docs.length).toBe(1);

          if (fs.existsSync(testDb)) { fs.unlinkSync(testDb); }
          if (fs.existsSync(testDb + '~')) { fs.unlinkSync(testDb + '~'); }
          expect(fs.existsSync(testDb)).toBe(false);
          expect(fs.existsSync(testDb + '~')).toBe(false);

          fs.writeFileSync(testDb + '~', 'bloup', 'utf8');
          expect(fs.existsSync(testDb + '~')).toBe(true);

          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            expect(err).toBeNull();
            expect(fs.existsSync(testDb)).toBe(true);
            expect(fs.existsSync(testDb + '~')).toBe(false);
            expect(contents).toMatch(/^{\"hello\":\"world\",\"_id\":\"[0-9a-zA-Z]{16}\"}\n$/);
            done();
          });
        });
      });
    });

    it('persistCachedDatabase should update the contents even if there is a temp datafile', function (done) {
      d.insert({ hello: 'world' }, function () {
        d.find({}, function (err, docs) {
          expect(docs.length).toBe(1);

          if (fs.existsSync(testDb)) { fs.unlinkSync(testDb); }
          fs.writeFileSync(testDb + '~', 'blabla', 'utf8');
          expect(fs.existsSync(testDb)).toBe(false);
          expect(fs.existsSync(testDb + '~')).toBe(true);

          d.persistence.persistCachedDatabase(function (err) {
            var contents = fs.readFileSync(testDb, 'utf8');
            expect(err).toBeNull();
            expect(fs.existsSync(testDb)).toBe(true);
            expect(fs.existsSync(testDb + '~')).toBe(false);
            expect(contents).toMatch(/^{\"hello\":\"world\",\"_id\":\"[0-9a-zA-Z]{16}\"}\n$/);
            done();
          });
        });
      });
    });

    it('persistCachedDatabase works even if only temp datafile exists', function (done) {
      var dbFile = 'workspace/test2.db', theDb;

      if (fs.existsSync(dbFile)) { fs.unlinkSync(dbFile); }
      if (fs.existsSync(dbFile + '~')) { fs.unlinkSync(dbFile + '~'); }

      theDb = new Datastore({ filename: dbFile });

      theDb.loadDatabase(function (err) {
        var contents = fs.readFileSync(dbFile, 'utf8');
        expect(err).toBeNull();
        expect(fs.existsSync(dbFile)).toBe(true);
        expect(fs.existsSync(dbFile + '~')).toBe(false);
        expect(contents).toBe("");
        done();
      });
    });
  });
});