var Index = require('../lib/indexes');

describe('Indexes', function () {
  describe('Insertion', function () {
    it('Can insert pointers to documents in the index correctly when they have the field', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('hello')).toEqual([{ a: 5, tf: 'hello' }]);
      expect(idx.tree.search('world')).toEqual([{ a: 8, tf: 'world' }]);
      expect(idx.tree.search('bloup')).toEqual([{ a: 2, tf: 'bloup' }]);

      expect(idx.tree.search('world')[0]).toBe(doc2);
      idx.tree.search('bloup')[0].a = 42;
      expect(doc3.a).toBe(42);
    });

    it('Inserting twice for the same fieldName in a unique index will result in an error thrown', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        ;

      idx.insert(doc1);
      expect(idx.tree.getNumberOfKeys()).toBe(1);
      expect(function () { idx.insert(doc1); }).toThrow();
    });

    it('Inserting twice for a fieldName the docs dont have with a unique index results in an error thrown', function () {
      var idx = new Index({ fieldName: 'nope', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 5, tf: 'world' }
        ;

      idx.insert(doc1);
      expect(idx.tree.getNumberOfKeys()).toBe(1);
      expect(function () { idx.insert(doc2); }).toThrow();
    });

    it('Inserting twice for a fieldName the docs dont have with a unique and sparse index will not throw', function () {
      var idx = new Index({ fieldName: 'nope', unique: true, sparse: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 5, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      expect(idx.tree.getNumberOfKeys()).toBe(0);
    });

    it('Works with dot notation', function () {
      var idx = new Index({ fieldName: 'tf.nested' })
        , doc1 = { a: 5, tf: { nested: 'hello' } }
        , doc2 = { a: 8, tf: { nested: 'world', additional: true } }
        , doc3 = { a: 2, tf: { nested: 'bloup', age: 42 } }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('hello')).toEqual([doc1]);
      expect(idx.tree.search('world')).toEqual([doc2]);
      expect(idx.tree.search('bloup')).toEqual([doc3]);

      idx.tree.search('bloup')[0].a = 42;
      expect(doc3.a).toBe(42);
    });

    it('Can insert an array of documents', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert([doc1, doc2, doc3]);
      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('hello')).toEqual([doc1]);
      expect(idx.tree.search('world')).toEqual([doc2]);
      expect(idx.tree.search('bloup')).toEqual([doc3]);
    });

    it('When inserting an array of elements, if an error is thrown all inserts need to be rolled back', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc2b = { a: 84, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      try {
        idx.insert([doc1, doc2, doc2b, doc3]);
      } catch (e) {
        expect(e.errorType).toBe('uniqueViolated');
      }
      expect(idx.tree.getNumberOfKeys()).toBe(0);
      expect(idx.tree.search('hello')).toEqual([]);
      expect(idx.tree.search('world')).toEqual([]);
      expect(idx.tree.search('bloup')).toEqual([]);
    });

    describe('Array fields', function () {
      it('Inserts one entry per array element in the index', function () {
        var obj = { tf: ['aa', 'bb'], really: 'yeah' }
          , obj2 = { tf: 'normal', yes: 'indeed' }
          , idx = new Index({ fieldName: 'tf' })
          ;

        idx.insert(obj);
        expect(idx.getAll().length).toBe(2);
        expect(idx.getAll()[0]).toBe(obj);
        expect(idx.getAll()[1]).toBe(obj);

        idx.insert(obj2);
        expect(idx.getAll().length).toBe(3);
      });

      it('Inserts one entry per array element in the index, type-checked', function () {
        var obj = { tf: ['42', 42, new Date(42), 42], really: 'yeah' }
          , idx = new Index({ fieldName: 'tf' })
          ;

        idx.insert(obj);
        expect(idx.getAll().length).toBe(3);
        expect(idx.getAll()[0]).toBe(obj);
        expect(idx.getAll()[1]).toBe(obj);
        expect(idx.getAll()[2]).toBe(obj);
      });

      it('Inserts one entry per unique array element in the index', function () {
        var obj = { tf: ['aa', 'aa'], really: 'yeah' }
          , obj2 = { tf: ['cc', 'yy', 'cc'], yes: 'indeed' }
          , idx = new Index({ fieldName: 'tf', unique: true })
          ;

        idx.insert(obj);
        expect(idx.getAll().length).toBe(1);
        expect(idx.getAll()[0]).toBe(obj);

        idx.insert(obj2);
        expect(idx.getAll().length).toBe(3);
      });

      it('The unique constraint holds across documents', function () {
        var obj = { tf: ['aa', 'aa'], really: 'yeah' }
          , obj2 = { tf: ['cc', 'aa', 'cc'], yes: 'indeed' }
          , idx = new Index({ fieldName: 'tf', unique: true })
          ;

        idx.insert(obj);
        expect(idx.getAll().length).toBe(1);
        expect(idx.getAll()[0]).toBe(obj);

        expect(function () { idx.insert(obj2); }).toThrow();
      });

      it('When removing a document, remove it from the index at all unique array elements', function () {
        var obj = { tf: ['aa', 'aa'], really: 'yeah' }
          , obj2 = { tf: ['cc', 'aa', 'cc'], yes: 'indeed' }
          , idx = new Index({ fieldName: 'tf' })
          ;

        idx.insert(obj);
        idx.insert(obj2);
        expect(idx.getMatching('aa').length).toBe(2);
        expect(idx.getMatching('aa').indexOf(obj)).not.toBe(-1);
        expect(idx.getMatching('aa').indexOf(obj2)).not.toBe(-1);
        expect(idx.getMatching('cc').length).toBe(1);

        idx.remove(obj2);
        expect(idx.getMatching('aa').length).toBe(1);
        expect(idx.getMatching('aa').indexOf(obj)).not.toBe(-1);
        expect(idx.getMatching('aa').indexOf(obj2)).toBe(-1);
        expect(idx.getMatching('cc').length).toBe(0);
      });

      it('If a unique constraint is violated when inserting an array key, roll back all inserts before the key', function () {
        var obj = { tf: ['aa', 'bb'], really: 'yeah' }
          , obj2 = { tf: ['cc', 'dd', 'aa', 'ee'], yes: 'indeed' }
          , idx = new Index({ fieldName: 'tf', unique: true })
          ;

        idx.insert(obj);
        expect(idx.getAll().length).toBe(2);
        expect(idx.getMatching('aa').length).toBe(1);
        expect(idx.getMatching('bb').length).toBe(1);
        expect(idx.getMatching('cc').length).toBe(0);
        expect(idx.getMatching('dd').length).toBe(0);
        expect(idx.getMatching('ee').length).toBe(0);

        expect(function () { idx.insert(obj2); }).toThrow();
        expect(idx.getAll().length).toBe(2);
        expect(idx.getMatching('aa').length).toBe(1);
        expect(idx.getMatching('bb').length).toBe(1);
        expect(idx.getMatching('cc').length).toBe(0);
        expect(idx.getMatching('dd').length).toBe(0);
        expect(idx.getMatching('ee').length).toBe(0);
      });
    });
  });

  describe('Removal', function () {
    it('Can remove pointers from the index, even when multiple documents have the same key', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc4 = { a: 23, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);
      expect(idx.tree.getNumberOfKeys()).toBe(3);

      idx.remove(doc1);
      expect(idx.tree.getNumberOfKeys()).toBe(2);
      expect(idx.tree.search('hello').length).toBe(0);

      idx.remove(doc2);
      expect(idx.tree.getNumberOfKeys()).toBe(2);
      expect(idx.tree.search('world').length).toBe(1);
      expect(idx.tree.search('world')[0]).toBe(doc4);
    });

    it('If we have a sparse index, removing a non indexed doc has no effect', function () {
      var idx = new Index({ fieldName: 'nope', sparse: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 5, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      expect(idx.tree.getNumberOfKeys()).toBe(0);

      idx.remove(doc1);
      expect(idx.tree.getNumberOfKeys()).toBe(0);
    });

    it('Works with dot notation', function () {
      var idx = new Index({ fieldName: 'tf.nested' })
        , doc1 = { a: 5, tf: { nested: 'hello' } }
        , doc2 = { a: 8, tf: { nested: 'world', additional: true } }
        , doc3 = { a: 2, tf: { nested: 'bloup', age: 42 } }
        , doc4 = { a: 2, tf: { nested: 'world', fruits: ['apple', 'carrot'] } }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);
      expect(idx.tree.getNumberOfKeys()).toBe(3);

      idx.remove(doc1);
      expect(idx.tree.getNumberOfKeys()).toBe(2);
      expect(idx.tree.search('hello').length).toBe(0);

      idx.remove(doc2);
      expect(idx.tree.getNumberOfKeys()).toBe(2);
      expect(idx.tree.search('world').length).toBe(1);
      expect(idx.tree.search('world')[0]).toBe(doc4);
    });

    it('Can remove an array of documents', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert([doc1, doc2, doc3]);
      expect(idx.tree.getNumberOfKeys()).toBe(3);
      idx.remove([doc1, doc3]);
      expect(idx.tree.getNumberOfKeys()).toBe(1);
      expect(idx.tree.search('hello')).toEqual([]);
      expect(idx.tree.search('world')).toEqual([doc2]);
      expect(idx.tree.search('bloup')).toEqual([]);
    });
  });

  describe('Update', function () {
    it('Can update a document whose key did or didnt change', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc4 = { a: 23, tf: 'world' }
        , doc5 = { a: 1, tf: 'changed' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('world')).toEqual([doc2]);

      idx.update(doc2, doc4);
      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('world')).toEqual([doc4]);

      idx.update(doc1, doc5);
      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('hello')).toEqual([]);
      expect(idx.tree.search('changed')).toEqual([doc5]);
    });

    it('If a simple update violates a unique constraint, changes are rolled back and an error thrown', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , bad = { a: 23, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('hello')).toEqual([doc1]);
      expect(idx.tree.search('world')).toEqual([doc2]);
      expect(idx.tree.search('bloup')).toEqual([doc3]);

      try {
        idx.update(doc3, bad);
      } catch (e) {
        expect(e.errorType).toBe('uniqueViolated');
      }

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('hello')).toEqual([doc1]);
      expect(idx.tree.search('world')).toEqual([doc2]);
      expect(idx.tree.search('bloup')).toEqual([doc3]);
    });

    it('Can update an array of documents', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc1b = { a: 23, tf: 'world' }
        , doc2b = { a: 1, tf: 'changed' }
        , doc3b = { a: 44, tf: 'bloup' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      expect(idx.tree.getNumberOfKeys()).toBe(3);

      idx.update([{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }]);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('world').length).toBe(1);
      expect(idx.getMatching('world')[0]).toBe(doc1b);
      expect(idx.getMatching('changed').length).toBe(1);
      expect(idx.getMatching('changed')[0]).toBe(doc2b);
      expect(idx.getMatching('bloup').length).toBe(1);
      expect(idx.getMatching('bloup')[0]).toBe(doc3b);
    });

    it('If a unique constraint is violated during an array-update, all changes are rolled back', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc0 = { a: 432, tf: 'notthistoo' }
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc1b = { a: 23, tf: 'changed' }
        , doc2b = { a: 1, tf: 'changed' }
        , doc2c = { a: 1, tf: 'notthistoo' }
        , doc3b = { a: 44, tf: 'alsochanged' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      expect(idx.tree.getNumberOfKeys()).toBe(3);

      try {
        idx.update([{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }]);
      } catch (e) {
        expect(e.errorType).toBe('uniqueViolated');
      }

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('hello')[0]).toBe(doc1);
      expect(idx.getMatching('world')[0]).toBe(doc2);
      expect(idx.getMatching('bloup')[0]).toBe(doc3);

      try {
        idx.update([{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }]);
      } catch (e) {
        expect(e.errorType).toBe('uniqueViolated');
      }

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('hello')[0]).toBe(doc1);
      expect(idx.getMatching('world')[0]).toBe(doc2);
      expect(idx.getMatching('bloup')[0]).toBe(doc3);
    });

    it('If an update doesnt change a document, the unique constraint is not violated', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , noChange = { a: 8, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('world')).toEqual([doc2]);

      idx.update(doc2, noChange);
      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.tree.search('world')).toEqual([noChange]);
    });

    it('Can revert simple and batch updates', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc1b = { a: 23, tf: 'world' }
        , doc2b = { a: 1, tf: 'changed' }
        , doc3b = { a: 44, tf: 'bloup' }
        , batchUpdate = [{ oldDoc: doc1, newDoc: doc1b }, { oldDoc: doc2, newDoc: doc2b }, { oldDoc: doc3, newDoc: doc3b }]
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      expect(idx.tree.getNumberOfKeys()).toBe(3);

      idx.update(batchUpdate);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('world').length).toBe(1);
      expect(idx.getMatching('world')[0]).toBe(doc1b);
      expect(idx.getMatching('changed').length).toBe(1);
      expect(idx.getMatching('changed')[0]).toBe(doc2b);
      expect(idx.getMatching('bloup').length).toBe(1);
      expect(idx.getMatching('bloup')[0]).toBe(doc3b);

      idx.revertUpdate(batchUpdate);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('hello').length).toBe(1);
      expect(idx.getMatching('hello')[0]).toBe(doc1);
      expect(idx.getMatching('world').length).toBe(1);
      expect(idx.getMatching('world')[0]).toBe(doc2);
      expect(idx.getMatching('bloup').length).toBe(1);
      expect(idx.getMatching('bloup')[0]).toBe(doc3);

      idx.update(doc2, doc2b);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('hello').length).toBe(1);
      expect(idx.getMatching('hello')[0]).toBe(doc1);
      expect(idx.getMatching('changed').length).toBe(1);
      expect(idx.getMatching('changed')[0]).toBe(doc2b);
      expect(idx.getMatching('bloup').length).toBe(1);
      expect(idx.getMatching('bloup')[0]).toBe(doc3);

      idx.revertUpdate(doc2, doc2b);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('hello').length).toBe(1);
      expect(idx.getMatching('hello')[0]).toBe(doc1);
      expect(idx.getMatching('world').length).toBe(1);
      expect(idx.getMatching('world')[0]).toBe(doc2);
      expect(idx.getMatching('bloup').length).toBe(1);
      expect(idx.getMatching('bloup')[0]).toBe(doc3);
    });
  });

  describe('Get matching documents', function () {
    it('Get all documents where fieldName is equal to the given value', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , doc4 = { a: 23, tf: 'world' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);

      expect(idx.getMatching('bloup')).toEqual([doc3]);
      expect(idx.getMatching('world')).toEqual([doc2, doc4]);
      expect(idx.getMatching('nope')).toEqual([]);
    });

    it('Can get all documents for a given key in a unique index', function () {
      var idx = new Index({ fieldName: 'tf', unique: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      expect(idx.getMatching('bloup')).toEqual([doc3]);
      expect(idx.getMatching('world')).toEqual([doc2]);
      expect(idx.getMatching('nope')).toEqual([]);
    });

    it('Can get all documents for which a field is undefined', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 2, nottf: 'bloup' }
        , doc3 = { a: 8, tf: 'world' }
        , doc4 = { a: 7, nottf: 'yes' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      expect(idx.getMatching('bloup')).toEqual([]);
      expect(idx.getMatching('hello')).toEqual([doc1]);
      expect(idx.getMatching('world')).toEqual([doc3]);
      expect(idx.getMatching('yes')).toEqual([]);
      expect(idx.getMatching(undefined)).toEqual([doc2]);

      idx.insert(doc4);

      expect(idx.getMatching('bloup')).toEqual([]);
      expect(idx.getMatching('hello')).toEqual([doc1]);
      expect(idx.getMatching('world')).toEqual([doc3]);
      expect(idx.getMatching('yes')).toEqual([]);
      expect(idx.getMatching(undefined)).toEqual([doc2, doc4]);
    });

    it('Can get all documents for which a field is null', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 2, tf: null }
        , doc3 = { a: 8, tf: 'world' }
        , doc4 = { a: 7, tf: null }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      expect(idx.getMatching('bloup')).toEqual([]);
      expect(idx.getMatching('hello')).toEqual([doc1]);
      expect(idx.getMatching('world')).toEqual([doc3]);
      expect(idx.getMatching('yes')).toEqual([]);
      expect(idx.getMatching(null)).toEqual([doc2]);

      idx.insert(doc4);

      expect(idx.getMatching('bloup')).toEqual([]);
      expect(idx.getMatching('hello')).toEqual([doc1]);
      expect(idx.getMatching('world')).toEqual([doc3]);
      expect(idx.getMatching('yes')).toEqual([]);
      expect(idx.getMatching(null)).toEqual([doc2, doc4]);
    });

    it('Can get all documents for a given key in a sparse index', function () {
      var idx = new Index({ fieldName: 'tf', sparse: true })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 2, nottf: 'bloup' }
        , doc3 = { a: 8, tf: 'world' }
        , doc4 = { a: 7, nottf: 'yes' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);

      expect(idx.getMatching('bloup')).toEqual([]);
      expect(idx.getMatching('hello')).toEqual([doc1]);
      expect(idx.getMatching('world')).toEqual([doc3]);
      expect(idx.getMatching('yes')).toEqual([]);
      expect(idx.getMatching(undefined)).toEqual([]);
    });

    it('Can get all documents whose key is in an array of keys', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello', _id: '1' }
        , doc2 = { a: 2, tf: 'bloup', _id: '2' }
        , doc3 = { a: 8, tf: 'world', _id: '3' }
        , doc4 = { a: 7, tf: 'yes', _id: '4' }
        , doc5 = { a: 7, tf: 'yes', _id: '5' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);
      idx.insert(doc5);

      expect(idx.getMatching([])).toEqual([]);
      expect(idx.getMatching(['bloup'])).toEqual([doc2]);
      expect(idx.getMatching(['bloup', 'yes'])).toEqual([doc2, doc4, doc5]);
      expect(idx.getMatching(['hello', 'no'])).toEqual([doc1]);
      expect(idx.getMatching(['nope', 'no'])).toEqual([]);
    });

    it('Can get all documents whose key is between certain bounds', function () {
      var idx = new Index({ fieldName: 'a' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 2, tf: 'bloup' }
        , doc3 = { a: 8, tf: 'world' }
        , doc4 = { a: 7, tf: 'yes' }
        , doc5 = { a: 10, tf: 'yes' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);
      idx.insert(doc4);
      idx.insert(doc5);

      expect(idx.getBetweenBounds({ $lt: 10, $gte: 5 })).toEqual([ doc1, doc4, doc3 ]);
      expect(idx.getBetweenBounds({ $lte: 8 })).toEqual([ doc2, doc1, doc4, doc3 ]);
      expect(idx.getBetweenBounds({ $gt: 7 })).toEqual([ doc3, doc5 ]);
    });
  });

  describe('Resetting', function () {
    it('Can reset an index without any new data', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('hello').length).toBe(1);
      expect(idx.getMatching('world').length).toBe(1);
      expect(idx.getMatching('bloup').length).toBe(1);

      idx.reset();
      expect(idx.tree.getNumberOfKeys()).toBe(0);
      expect(idx.getMatching('hello').length).toBe(0);
      expect(idx.getMatching('world').length).toBe(0);
      expect(idx.getMatching('bloup').length).toBe(0);
    });

    it('Can reset an index and initialize it with one document', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , newDoc = { a: 555, tf: 'new' }
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('hello').length).toBe(1);
      expect(idx.getMatching('world').length).toBe(1);
      expect(idx.getMatching('bloup').length).toBe(1);

      idx.reset(newDoc);
      expect(idx.tree.getNumberOfKeys()).toBe(1);
      expect(idx.getMatching('hello').length).toBe(0);
      expect(idx.getMatching('world').length).toBe(0);
      expect(idx.getMatching('bloup').length).toBe(0);
      expect(idx.getMatching('new')[0].a).toBe(555);
    });

    it('Can reset an index and initialize it with an array of documents', function () {
      var idx = new Index({ fieldName: 'tf' })
        , doc1 = { a: 5, tf: 'hello' }
        , doc2 = { a: 8, tf: 'world' }
        , doc3 = { a: 2, tf: 'bloup' }
        , newDocs = [{ a: 555, tf: 'new' }, { a: 666, tf: 'again' }]
        ;

      idx.insert(doc1);
      idx.insert(doc2);
      idx.insert(doc3);

      expect(idx.tree.getNumberOfKeys()).toBe(3);
      expect(idx.getMatching('hello').length).toBe(1);
      expect(idx.getMatching('world').length).toBe(1);
      expect(idx.getMatching('bloup').length).toBe(1);

      idx.reset(newDocs);
      expect(idx.tree.getNumberOfKeys()).toBe(2);
      expect(idx.getMatching('hello').length).toBe(0);
      expect(idx.getMatching('world').length).toBe(0);
      expect(idx.getMatching('bloup').length).toBe(0);
      expect(idx.getMatching('new')[0].a).toBe(555);
      expect(idx.getMatching('again')[0].a).toBe(666);
    });
  });

  it('Get all elements in the index', function () {
    var idx = new Index({ fieldName: 'a' })
      , doc1 = { a: 5, tf: 'hello' }
      , doc2 = { a: 8, tf: 'world' }
      , doc3 = { a: 2, tf: 'bloup' }
      ;

    idx.insert(doc1);
    idx.insert(doc2);
    idx.insert(doc3);

    expect(idx.getAll()).toEqual([{ a: 2, tf: 'bloup' }, { a: 5, tf: 'hello' }, { a: 8, tf: 'world' }]);
  });
});