var model = require('../lib/model');
var Datastore = require('../lib/datastore');
var fs = require('fs');
var path = require('path');

function isDate(obj) {
  return Object.prototype.toString.call(obj) === '[object Date]';
}

describe('Model', function () {
  describe('Serialization, deserialization', function () {
    it('Can serialize and deserialize strings', function () {
      var a, b, c;

      a = { test: "Some string" };
      b = model.serialize(a);
      c = model.deserialize(b);
      expect(b.indexOf('\n')).toBe(-1);
      expect(c.test).toBe("Some string");

      a = { test: "With a new\nline" };
      b = model.serialize(a);
      c = model.deserialize(b);
      expect(c.test).toBe("With a new\nline");
      expect(a.test.indexOf('\n')).not.toBe(-1);
      expect(b.indexOf('\n')).toBe(-1);
      expect(c.test.indexOf('\n')).not.toBe(-1);
    });

    it('Can serialize and deserialize booleans', function () {
      var a, b, c;

      a = { test: true };
      b = model.serialize(a);
      c = model.deserialize(b);
      expect(b.indexOf('\n')).toBe(-1);
      expect(c.test).toBe(true);
    });

    it('Can serialize and deserialize numbers', function () {
      var a, b, c;

      a = { test: 5 };
      b = model.serialize(a);
      c = model.deserialize(b);
      expect(b.indexOf('\n')).toBe(-1);
      expect(c.test).toBe(5);
    });

    it('Can serialize and deserialize null', function () {
      var a, b, c;

      a = { test: null };
      b = model.serialize(a);
      c = model.deserialize(b);
      expect(b.indexOf('\n')).toBe(-1);
      expect(a.test).toBeNull();
    });

    it('undefined fields are removed when serialized', function() {
      var a = { bloup: undefined, hello: 'world' }
        , b = model.serialize(a)
        , c = model.deserialize(b)
        ;

      expect(Object.keys(c).length).toBe(1);
      expect(c.hello).toBe('world');
      expect(c.bloup).toBeUndefined();
    });

    it('Can serialize and deserialize a date', function () {
      var a, b, c
        , d = new Date();

      a = { test: d };
      b = model.serialize(a);
      c = model.deserialize(b);
      expect(b.indexOf('\n')).toBe(-1);
      expect(b).toBe('{"test":{"$$date":' + d.getTime() + '}}');
      expect(isDate(c.test)).toBe(true);
      expect(c.test.getTime()).toBe(d.getTime());
    });

    it('Can serialize and deserialize sub objects', function () {
      var a, b, c
        , d = new Date();

      a = { test: { something: 39, also: d, yes: { again: 'yes' } } };
      b = model.serialize(a);
      c = model.deserialize(b);
      expect(b.indexOf('\n')).toBe(-1);
      expect(c.test.something).toBe(39);
      expect(c.test.also.getTime()).toBe(d.getTime());
      expect(c.test.yes.again).toBe('yes');
    });

    it('Can serialize and deserialize sub arrays', function () {
      var a, b, c
        , d = new Date();

      a = { test: [ 39, d, { again: 'yes' } ] };
      b = model.serialize(a);
      c = model.deserialize(b);
      expect(b.indexOf('\n')).toBe(-1);
      expect(c.test[0]).toBe(39);
      expect(c.test[1].getTime()).toBe(d.getTime());
      expect(c.test[2].again).toBe('yes');
    });

    it('Reject field names beginning with a $ sign or containing a dot, except the four edge cases', function () {
      var a1 = { $something: 'totest' }
        , a2 = { "with.dot": 'totest' }
        , e1 = { $$date: 4321 }
        , e2 = { $$deleted: true }
        , e3 = { $$indexCreated: "indexName" }
        , e4 = { $$indexRemoved: "indexName" }
        , b;

      expect(function () { b = model.serialize(a1); }).toThrow();
      expect(function () { b = model.serialize(a2); }).toThrow();

      b = model.serialize(e1);
      b = model.serialize(e2);
      b = model.serialize(e3);
      b = model.serialize(e4);
    });

    it('Can serialize string fields with a new line without breaking the DB', async function () {
      var db1, db2
        , badString = "world\r\nearth\nother\rline"
        , testFile = 'workspace/test1.db';

      if (fs.existsSync(testFile)) { fs.unlinkSync(testFile); }
      expect(fs.existsSync(testFile)).toBe(false);
      db1 = new Datastore({ filename: testFile });

      await new Promise((resolve, reject) => {
        db1.loadDatabase(function (err) {
          if (err) return reject(err);
          db1.insert({ hello: badString }, function (err) {
            if (err) return reject(err);

            db2 = new Datastore({ filename: testFile });
            db2.loadDatabase(function (err) {
              if (err) return reject(err);
              db2.find({}, function (err, docs) {
                if (err) return reject(err);
                expect(docs.length).toBe(1);
                expect(docs[0].hello).toBe(badString);
                resolve();
              });
            });
          });
        });
      });
    });

    it('Can accept objects whose keys are numbers', function () {
      var o = { 42: true };
      var s = model.serialize(o);
    });
  });

  describe('Object checking', function () {
    it('Field names beginning with a $ sign are forbidden', function () {
      expect(model.checkObject).toBeDefined();

      expect(function () {
        model.checkObject({ $bad: true });
      }).toThrow();

      expect(function () {
        model.checkObject({ some: 42, nested: { again: "no", $worse: true } });
      }).toThrow();

      model.checkObject({ some: 42, nested: [ 5, "no", "$actuallyok", true ] });

      expect(function () {
        model.checkObject({ some: 42, nested: [ 5, "no", "$actuallyok", true, { $hidden: "useless" } ] });
      }).toThrow();
    });

    it('Field names cannot contain a .', function () {
      expect(model.checkObject).toBeDefined();

      expect(function () {
        model.checkObject({ "so.bad": true });
      }).toThrow();
    });

    it('Properties with a null value dont trigger an error', function () {
      var obj = { prop: null };
      model.checkObject(obj);
    });

    it('Can check if an object is a primitive or not', function () {
      expect(model.isPrimitiveType(5)).toBe(true);
      expect(model.isPrimitiveType('sdsfdfs')).toBe(true);
      expect(model.isPrimitiveType(0)).toBe(true);
      expect(model.isPrimitiveType(true)).toBe(true);
      expect(model.isPrimitiveType(false)).toBe(true);
      expect(model.isPrimitiveType(new Date())).toBe(true);
      expect(model.isPrimitiveType([])).toBe(true);
      expect(model.isPrimitiveType([3, 'try'])).toBe(true);
      expect(model.isPrimitiveType(null)).toBe(true);

      expect(model.isPrimitiveType({})).toBe(false);
      expect(model.isPrimitiveType({ a: 42 })).toBe(false);
    });
  });

  describe('Deep copying', function () {
    it('Should be able to deep copy any serializable model', function () {
      var d = new Date()
        , obj = { a: ['ee', 'ff', 42], date: d, subobj: { a: 'b', b: 'c' } }
        , res = model.deepCopy(obj);

      expect(res.a.length).toBe(3);
      expect(res.a[0]).toBe('ee');
      expect(res.a[1]).toBe('ff');
      expect(res.a[2]).toBe(42);
      expect(res.date.getTime()).toBe(d.getTime());
      expect(res.subobj.a).toBe('b');
      expect(res.subobj.b).toBe('c');

      obj.a.push('ggg');
      obj.date = 'notadate';
      obj.subobj = [];

      expect(res.a.length).toBe(3);
      expect(res.a[0]).toBe('ee');
      expect(res.a[1]).toBe('ff');
      expect(res.a[2]).toBe(42);
      expect(res.date.getTime()).toBe(d.getTime());
      expect(res.subobj.a).toBe('b');
      expect(res.subobj.b).toBe('c');
    });

    it('Should deep copy the contents of an array', function () {
      var a = [{ hello: 'world' }]
        , b = model.deepCopy(a);

      expect(b[0].hello).toBe('world');
      b[0].hello = 'another';
      expect(b[0].hello).toBe('another');
      expect(a[0].hello).toBe('world');
    });

    it('Without the strictKeys option, everything gets deep copied', function () {
      var a = { a: 4, $e: 'rrr', 'eee.rt': 42, nested: { yes: 1, 'tt.yy': 2, $nopenope: 3 }, array: [{ 'rr.hh': 1 }, { yes: true }, { $yes: false }] }
        , b = model.deepCopy(a);

      expect(a).toEqual(b);
    });

    it('With the strictKeys option, only valid keys gets deep copied', function () {
      var a = { a: 4, $e: 'rrr', 'eee.rt': 42, nested: { yes: 1, 'tt.yy': 2, $nopenope: 3 }, array: [{ 'rr.hh': 1 }, { yes: true }, { $yes: false }] }
        , b = model.deepCopy(a, true);

      expect(b).toEqual({ a: 4, nested: { yes: 1 }, array: [{}, { yes: true }, {}] });
    });
  });

  describe('Modifying documents', function () {
    it('Queries not containing any modifier just replace the document by the contents of the query but keep its _id', function () {
      var obj = { some: 'thing', _id: 'keepit' }
        , updateQuery = { replace: 'done', bloup: [ 1, 8] }
        , t
        ;

      t = model.modify(obj, updateQuery);
      expect(t.replace).toBe('done');
      expect(t.bloup.length).toBe(2);
      expect(t.bloup[0]).toBe(1);
      expect(t.bloup[1]).toBe(8);

      expect(t.some).toBeUndefined();
      expect(t._id).toBe('keepit');
    });

    it('Throw an error if trying to change the _id field in a copy-type modification', function () {
      var obj = { some: 'thing', _id: 'keepit' }
        , updateQuery = { replace: 'done', bloup: [ 1, 8], _id: 'donttryit' }
        ;

      expect(function () {
        model.modify(obj, updateQuery);
      }).toThrow("You cannot change a document's _id");

      updateQuery._id = 'keepit';
      model.modify(obj, updateQuery);
    });

    it('Throw an error if trying to use modify in a mixed copy+modify way', function () {
      var obj = { some: 'thing' }
        , updateQuery = { replace: 'me', $modify: 'metoo' };

      expect(function () {
        model.modify(obj, updateQuery);
      }).toThrow("You cannot mix modifiers and normal fields");
    });

    it('Throw an error if trying to use an inexistent modifier', function () {
      var obj = { some: 'thing' }
        , updateQuery = { $set: { it: 'exists' }, $modify: 'not this one' };

      expect(function () {
        model.modify(obj, updateQuery);
      }).toThrow(/^Unknown modifier .modify/);
    });

    it('Throw an error if a modifier is used with a non-object argument', function () {
      var obj = { some: 'thing' }
        , updateQuery = { $set: 'this exists' };

      expect(function () {
        model.modify(obj, updateQuery);
      }).toThrow(/Modifier .set's argument must be an object/);
    });

    describe('$set modifier', function () {
      it('Can change already set fields without modifying the underlying object', function () {
        var obj = { some: 'thing', yup: 'yes', nay: 'noes' }
          , updateQuery = { $set: { some: 'changed', nay: 'yes indeed' } }
          , modified = model.modify(obj, updateQuery);

        expect(Object.keys(modified).length).toBe(3);
        expect(modified.some).toBe('changed');
        expect(modified.yup).toBe('yes');
        expect(modified.nay).toBe('yes indeed');

        expect(Object.keys(obj).length).toBe(3);
        expect(obj.some).toBe('thing');
        expect(obj.yup).toBe('yes');
        expect(obj.nay).toBe('noes');
      });

      it('Creates fields to set if they dont exist yet', function () {
        var obj = { yup: 'yes' }
          , updateQuery = { $set: { some: 'changed', nay: 'yes indeed' } }
          , modified = model.modify(obj, updateQuery);

        expect(Object.keys(modified).length).toBe(3);
        expect(modified.some).toBe('changed');
        expect(modified.yup).toBe('yes');
        expect(modified.nay).toBe('yes indeed');
      });

      it('Can set sub-fields and create them if necessary', function () {
        var obj = { yup: { subfield: 'bloup' } }
          , updateQuery = { $set: { "yup.subfield": 'changed', "yup.yop": 'yes indeed', "totally.doesnt.exist": 'now it does' } }
          , modified = model.modify(obj, updateQuery);

        expect(modified).toEqual({ yup: { subfield: 'changed', yop: 'yes indeed' }, totally: { doesnt: { exist: 'now it does' } } });
      });

      it("Doesn't replace a falsy field by an object when recursively following dot notation", function () {
        var obj = { nested: false }
          , updateQuery = { $set: { "nested.now": 'it is' } }
          , modified = model.modify(obj, updateQuery);

        expect(modified).toEqual({ nested: false });
      });
    });

    describe('$unset modifier', function () {
      it('Can delete a field, not throwing an error if the field doesnt exist', function () {
        var obj, updateQuery, modified;

        obj = { yup: 'yes', other: 'also' };
        updateQuery = { $unset: { yup: true } };
        modified = model.modify(obj, updateQuery);
        expect(modified).toEqual({ other: 'also' });

        obj = { yup: 'yes', other: 'also' };
        updateQuery = { $unset: { nope: true } };
        modified = model.modify(obj, updateQuery);
        expect(modified).toEqual(obj);

        obj = { yup: 'yes', other: 'also' };
        updateQuery = { $unset: { nope: true, other: true } };
        modified = model.modify(obj, updateQuery);
        expect(modified).toEqual({ yup: 'yes' });
      });

      it('Can unset sub-fields and entire nested documents', function () {
        var obj, updateQuery, modified;

        obj = { yup: 'yes', nested: { a: 'also', b: 'yeah' } };
        updateQuery = { $unset: { nested: true } };
        modified = model.modify(obj, updateQuery);
        expect(modified).toEqual({ yup: 'yes' });

        obj = { yup: 'yes', nested: { a: 'also', b: 'yeah' } };
        updateQuery = { $unset: { 'nested.a': true } };
        modified = model.modify(obj, updateQuery);
        expect(modified).toEqual({ yup: 'yes', nested: { b: 'yeah' } });

        obj = { yup: 'yes', nested: { a: 'also', b: 'yeah' } };
        updateQuery = { $unset: { 'nested.a': true, 'nested.b': true } };
        modified = model.modify(obj, updateQuery);
        expect(modified).toEqual({ yup: 'yes', nested: {} });
      });

      it("When unsetting nested fields, should not create an empty parent to nested field", function () {
        var obj = model.modify({ argh: true }, { $unset: { 'bad.worse': true } });
        expect(obj).toEqual({ argh: true });

        obj = model.modify({ argh: true, bad: { worse: 'oh' } }, { $unset: { 'bad.worse': true } });
        expect(obj).toEqual({ argh: true, bad: {} });

        obj = model.modify({ argh: true, bad: {} }, { $unset: { 'bad.worse': true } });
        expect(obj).toEqual({ argh: true, bad: {} });
      });
    });

    describe('$inc modifier', function () {
      it('Throw an error if you try to use it with a non-number or on a non number field', function () {
        expect(function () {
          var obj = { some: 'thing', yup: 'yes', nay: 2 }
            , updateQuery = { $inc: { nay: 'notanumber' } };
          model.modify(obj, updateQuery);
        }).toThrow();

        expect(function () {
          var obj = { some: 'thing', yup: 'yes', nay: 'nope' }
            , updateQuery = { $inc: { nay: 1 } };
          model.modify(obj, updateQuery);
        }).toThrow();
      });

      it('Can increment number fields or create and initialize them if needed', function () {
        var obj = { some: 'thing', nay: 40 }
          , modified;

        modified = model.modify(obj, { $inc: { nay: 2 } });
        expect(modified).toEqual({ some: 'thing', nay: 42 });

        modified = model.modify(obj, { $inc: { inexistent: -6 } });
        expect(modified).toEqual({ some: 'thing', nay: 40, inexistent: -6 });
      });

      it('Works recursively', function () {
        var obj = { some: 'thing', nay: { nope: 40 } }
          , modified;

        modified = model.modify(obj, { $inc: { "nay.nope": -2, "blip.blop": 123 } });
        expect(modified).toEqual({ some: 'thing', nay: { nope: 38 }, blip: { blop: 123 } });
      });
    });

    describe('$push modifier', function () {
      it('Can push an element to the end of an array', function () {
        var obj = { arr: ['hello'] }
          , modified;

        modified = model.modify(obj, { $push: { arr: 'world' } });
        expect(modified).toEqual({ arr: ['hello', 'world'] });
      });

      it('Can push an element to a non-existent field and will create the array', function () {
        var obj = {}
          , modified;

        modified = model.modify(obj, { $push: { arr: 'world' } });
        expect(modified).toEqual({ arr: ['world'] });
      });

      it('Can push on nested fields', function () {
        var obj = { arr: { nested: ['hello'] } }
          , modified;

        modified = model.modify(obj, { $push: { "arr.nested": 'world' } });
        expect(modified).toEqual({ arr: { nested: ['hello', 'world'] } });

        obj = { arr: { a: 2 }};
        modified = model.modify(obj, { $push: { "arr.nested": 'world' } });
        expect(modified).toEqual({ arr: { a: 2, nested: ['world'] } });
      });

      it('Throw if we try to push to a non-array', function () {
        var obj = { arr: 'hello' }
          , modified;

        expect(function () {
          modified = model.modify(obj, { $push: { arr: 'world' } });
        }).toThrow();

        obj = { arr: { nested: 45 } };
        expect(function () {
          modified = model.modify(obj, { $push: { "arr.nested": 'world' } });
        }).toThrow();
      });

      it('Can use the $each modifier to add multiple values to an array at once', function () {
        var obj = { arr: ['hello'] }
          , modified;

        modified = model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'] } } });
        expect(modified).toEqual({ arr: ['hello', 'world', 'earth', 'everything'] });

        expect(function () {
          modified = model.modify(obj, { $push: { arr: { $each: 45 } } });
        }).toThrow();

        expect(function () {
          modified = model.modify(obj, { $push: { arr: { $each: ['world'], unauthorized: true } } });
        }).toThrow();
      });

      it('Can use the $slice modifier to limit the number of array elements', function () {
        var obj = { arr: ['hello'] }
          , modified;

        modified = model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: 1 } } });
        expect(modified).toEqual({ arr: ['hello'] });

        modified = model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: -1 } } });
        expect(modified).toEqual({ arr: ['everything'] });

        modified = model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: 0 } } });
        expect(modified).toEqual({ arr: [] });

        modified = model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: 2 } } });
        expect(modified).toEqual({ arr: ['hello', 'world'] });

        modified = model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: -2 } } });
        expect(modified).toEqual({ arr: ['earth', 'everything'] });

        modified = model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: -20 } } });
        expect(modified).toEqual({ arr: ['hello', 'world', 'earth', 'everything'] });

        modified = model.modify(obj, { $push: { arr: { $each: ['world', 'earth', 'everything'], $slice: 20 } } });
        expect(modified).toEqual({ arr: ['hello', 'world', 'earth', 'everything'] });
      });
    });

    describe('$addToSet modifier', function () {
      it('Can add an element to a set', function () {
        var obj = { arr: [] }
          , modified;

        modified = model.modify(obj, { $addToSet: { arr: 'world' } });
        expect(modified).toEqual({ arr: ['world'] });
      });

      it('Throw if we try to addToSet to a non-array', function () {
        var obj = { arr: 'hello' }
          , modified;

        expect(function () {
          modified = model.modify(obj, { $addToSet: { arr: 'world' } });
        }).toThrow();
      });

      it('Use deep-equality to check whether we can add a value to a set', function () {
        var obj = { arr: [ { b: 2 } ] }
          , modified;

        modified = model.modify(obj, { $addToSet: { arr: { b: 3 } } });
        expect(modified).toEqual({ arr: [{ b: 2 }, { b: 3 }] });

        obj = { arr: [ { b: 2 } ] };
        modified = model.modify(obj, { $addToSet: { arr: { b: 2 } } });
        expect(modified).toEqual({ arr: [{ b: 2 }] });
      });

      it('Can use the $each modifier to add multiple values to a set at once', function () {
        var obj = { arr: ['hello'] }
          , modified;

        modified = model.modify(obj, { $addToSet: { arr: { $each: ['world', 'earth', 'hello', 'earth'] } } });
        expect(modified).toEqual({ arr: ['hello', 'world', 'earth'] });

        expect(function () {
          modified = model.modify(obj, { $addToSet: { arr: { $each: 45 } } });
        }).toThrow();

        expect(function () {
          modified = model.modify(obj, { $addToSet: { arr: { $each: ['world'], unauthorized: true } } });
        }).toThrow();
      });
    });

    describe('$pop modifier', function () {
      it('Throw if called on a non array, a non defined field or a non integer', function () {
        var obj = { arr: 'hello' }
          , modified;

        expect(function () {
          modified = model.modify(obj, { $pop: { arr: 1 } });
        }).toThrow();

        obj = { bloup: 'nope' };
        expect(function () {
          modified = model.modify(obj, { $pop: { arr: 1 } });
        }).toThrow();

        obj = { arr: [1, 4, 8] };
        expect(function () {
          modified = model.modify(obj, { $pop: { arr: true } });
        }).toThrow();
      });

      it('Can remove the first and last element of an array', function () {
        var obj
          , modified;

        obj = { arr: [1, 4, 8] };
        modified = model.modify(obj, { $pop: { arr: 1 } });
        expect(modified).toEqual({ arr: [1, 4] });

        obj = { arr: [1, 4, 8] };
        modified = model.modify(obj, { $pop: { arr: -1 } });
        expect(modified).toEqual({ arr: [4, 8] });

        obj = { arr: [] };
        modified = model.modify(obj, { $pop: { arr: 1 } });
        expect(modified).toEqual({ arr: [] });
        modified = model.modify(obj, { $pop: { arr: -1 } });
        expect(modified).toEqual({ arr: [] });
      });
    });

    describe('$pull modifier', function () {
      it('Can remove an element from a set', function () {
        var obj = { arr: ['hello', 'world'] }
          , modified;

        modified = model.modify(obj, { $pull: { arr: 'world' } });
        expect(modified).toEqual({ arr: ['hello'] });

        obj = { arr: ['hello'] };
        modified = model.modify(obj, { $pull: { arr: 'world' } });
        expect(modified).toEqual({ arr: ['hello'] });
      });

      it('Can remove multiple matching elements', function () {
        var obj = { arr: ['hello', 'world', 'hello', 'world'] }
          , modified;

        modified = model.modify(obj, { $pull: { arr: 'world' } });
        expect(modified).toEqual({ arr: ['hello', 'hello'] });
      });

      it('Throw if we try to pull from a non-array', function () {
        var obj = { arr: 'hello' }
          , modified;

        expect(function () {
          modified = model.modify(obj, { $pull: { arr: 'world' } });
        }).toThrow();
      });

      it('Use deep-equality to check whether we can remove a value from a set', function () {
        var obj = { arr: [{ b: 2 }, { b: 3 }] }
          , modified;

        modified = model.modify(obj, { $pull: { arr: { b: 3 } } });
        expect(modified).toEqual({ arr: [ { b: 2 } ] });

        obj = { arr: [ { b: 2 } ] };
        modified = model.modify(obj, { $pull: { arr: { b: 3 } } });
        expect(modified).toEqual({ arr: [{ b: 2 }] });
      });

      it('Can use any kind of nedb query with $pull', function () {
        var obj = { arr: [4, 7, 12, 2], other: 'yup' }
          , modified;

        modified = model.modify(obj, { $pull: { arr: { $gte: 5 } } });
        expect(modified).toEqual({ arr: [4, 2], other: 'yup' });

        obj = { arr: [{ b: 4 }, { b: 7 }, { b: 1 }], other: 'yeah' };
        modified = model.modify(obj, { $pull: { arr: { b: { $gte: 5} } } });
        expect(modified).toEqual({ arr: [{ b: 4 }, { b: 1 }], other: 'yeah' });
      });
    });

    describe('$max modifier', function () {
      it('Will set the field to the updated value if value is greater than current one', function () {
        var obj = { some:'thing', number: 10 }
            , updateQuery = { $max: { number:12 } }
            , modified = model.modify(obj, updateQuery);

        expect(modified).toEqual({ some: 'thing', number: 12 });
        expect(obj).toEqual({ some: 'thing', number: 10 });
      });

      it('Will not update the field if new value is smaller than current one', function () {
        var obj = { some:'thing', number: 10 }
            , updateQuery = { $max: { number: 9 } }
            , modified = model.modify(obj, updateQuery);

        expect(modified).toEqual({ some:'thing', number:10 });
      });

      it('Will create the field if it does not exist', function () {
        var obj = { some: 'thing' }
            , updateQuery = { $max: { number: 10 } }
            , modified = model.modify(obj, updateQuery);

        expect(modified).toEqual({ some: 'thing', number: 10 });
      });

      it('Works on embedded documents', function () {
        var obj = { some: 'thing', somethingElse: { number:10 } }
            , updateQuery = { $max: { 'somethingElse.number': 12 } }
            , modified = model.modify(obj,updateQuery);

        expect(modified).toEqual({ some: 'thing', somethingElse: { number:12 } });
      });
    });

    describe('$min modifier', function () {
      it('Will set the field to the updated value if value is smaller than current one', function () {
        var obj = { some:'thing', number: 10 }
            , updateQuery = { $min: { number: 8 } }
            , modified = model.modify(obj, updateQuery);

        expect(modified).toEqual({ some: 'thing', number: 8 });
        expect(obj).toEqual({ some: 'thing', number: 10 });
      });

      it('Will not update the field if new value is greater than current one', function () {
        var obj = { some: 'thing', number: 10 }
            , updateQuery = { $min: { number: 12 } }
            , modified = model.modify(obj, updateQuery);

        expect(modified).toEqual({ some: 'thing', number: 10 });
      });

      it('Will create the field if it does not exist', function () {
        var obj = { some: 'thing' }
            , updateQuery = { $min: { number: 10 } }
            , modified = model.modify(obj, updateQuery);

        expect(modified).toEqual({ some: 'thing', number: 10 });
      });

      it('Works on embedded documents', function () {
        var obj = { some: 'thing', somethingElse: { number: 10 } }
            , updateQuery = { $min: { 'somethingElse.number': 8 } }
            , modified = model.modify(obj, updateQuery);

        expect(modified).toEqual({ some: 'thing', somethingElse: { number: 8 } } );
      });
    });
  });

  describe('Comparing things', function () {
    it('undefined is the smallest', function () {
      var otherStuff = [null, "string", "", -1, 0, 5.3, 12, true, false, new Date(12345), {}, { hello: 'world' }, [], ['quite', 5]];

      expect(model.compareThings(undefined, undefined)).toBe(0);

      otherStuff.forEach(function (stuff) {
        expect(model.compareThings(undefined, stuff)).toBe(-1);
        expect(model.compareThings(stuff, undefined)).toBe(1);
      });
    });

    it('Then null', function () {
      var otherStuff = ["string", "", -1, 0, 5.3, 12, true, false, new Date(12345), {}, { hello: 'world' }, [], ['quite', 5]];

      expect(model.compareThings(null, null)).toBe(0);

      otherStuff.forEach(function (stuff) {
        expect(model.compareThings(null, stuff)).toBe(-1);
        expect(model.compareThings(stuff, null)).toBe(1);
      });
    });

    it('Then numbers', function () {
      var otherStuff = ["string", "", true, false, new Date(4312), {}, { hello: 'world' }, [], ['quite', 5]]
        , numbers = [-12, 0, 12, 5.7];

      expect(model.compareThings(-12, 0)).toBe(-1);
      expect(model.compareThings(0, -3)).toBe(1);
      expect(model.compareThings(5.7, 2)).toBe(1);
      expect(model.compareThings(5.7, 12.3)).toBe(-1);
      expect(model.compareThings(0, 0)).toBe(0);
      expect(model.compareThings(-2.6, -2.6)).toBe(0);
      expect(model.compareThings(5, 5)).toBe(0);

      otherStuff.forEach(function (stuff) {
        numbers.forEach(function (number) {
          expect(model.compareThings(number, stuff)).toBe(-1);
          expect(model.compareThings(stuff, number)).toBe(1);
        });
      });
    });

    it('Then strings', function () {
      var otherStuff = [true, false, new Date(4321), {}, { hello: 'world' }, [], ['quite', 5]]
        , strings = ['', 'string', 'hello world'];

      expect(model.compareThings('', 'hey')).toBe(-1);
      expect(model.compareThings('hey', '')).toBe(1);
      expect(model.compareThings('hey', 'hew')).toBe(1);
      expect(model.compareThings('hey', 'hey')).toBe(0);

      otherStuff.forEach(function (stuff) {
        strings.forEach(function (string) {
          expect(model.compareThings(string, stuff)).toBe(-1);
          expect(model.compareThings(stuff, string)).toBe(1);
        });
      });
    });

    it('Then booleans', function () {
      var otherStuff = [new Date(4321), {}, { hello: 'world' }, [], ['quite', 5]]
        , bools = [true, false];

      expect(model.compareThings(true, true)).toBe(0);
      expect(model.compareThings(false, false)).toBe(0);
      expect(model.compareThings(true, false)).toBe(1);
      expect(model.compareThings(false, true)).toBe(-1);

      otherStuff.forEach(function (stuff) {
        bools.forEach(function (bool) {
          expect(model.compareThings(bool, stuff)).toBe(-1);
          expect(model.compareThings(stuff, bool)).toBe(1);
        });
      });
    });

    it('Then dates', function () {
      var otherStuff = [{}, { hello: 'world' }, [], ['quite', 5]]
        , dates = [new Date(-123), new Date(), new Date(5555), new Date(0)]
        , now = new Date();

      expect(model.compareThings(now, now)).toBe(0);
      expect(model.compareThings(new Date(54341), now)).toBe(-1);
      expect(model.compareThings(now, new Date(54341))).toBe(1);
      expect(model.compareThings(new Date(0), new Date(-54341))).toBe(1);
      expect(model.compareThings(new Date(123), new Date(4341))).toBe(-1);

      otherStuff.forEach(function (stuff) {
        dates.forEach(function (date) {
          expect(model.compareThings(date, stuff)).toBe(-1);
          expect(model.compareThings(stuff, date)).toBe(1);
        });
      });
    });

    it('Then arrays', function () {
      var otherStuff = [{}, { hello: 'world' }]
        , arrays = [[], ['yes'], ['hello', 5]];

      expect(model.compareThings([], [])).toBe(0);
      expect(model.compareThings(['hello'], [])).toBe(1);
      expect(model.compareThings([], ['hello'])).toBe(-1);
      expect(model.compareThings(['hello'], ['hello', 'world'])).toBe(-1);
      expect(model.compareThings(['hello', 'earth'], ['hello', 'world'])).toBe(-1);
      expect(model.compareThings(['hello', 'zzz'], ['hello', 'world'])).toBe(1);
      expect(model.compareThings(['hello', 'world'], ['hello', 'world'])).toBe(0);

      otherStuff.forEach(function (stuff) {
        arrays.forEach(function (array) {
          expect(model.compareThings(array, stuff)).toBe(-1);
          expect(model.compareThings(stuff, array)).toBe(1);
        });
      });
    });

    it('And finally objects', function () {
      expect(model.compareThings({}, {})).toBe(0);
      expect(model.compareThings({ a: 42 }, { a: 312})).toBe(-1);
      expect(model.compareThings({ a: '42' }, { a: '312'})).toBe(1);
      expect(model.compareThings({ a: 42, b: 312 }, { b: 312, a: 42 })).toBe(0);
      expect(model.compareThings({ a: 42, b: 312, c: 54 }, { b: 313, a: 42 })).toBe(-1);
    });

    it('Can specify custom string comparison function', function () {
      expect(model.compareThings('hello', 'bloup', function (a, b) { return a < b ? -1 : 1; })).toBe(1);
      expect(model.compareThings('hello', 'bloup', function (a, b) { return a > b ? -1 : 1; })).toBe(-1);
    });
  });
});