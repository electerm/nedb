var customUtils = require('../lib/customUtils');

describe('customUtils', function () {
  describe('uid', function () {
    it('Generates a string of the expected length', function () {
      expect(customUtils.uid(3).length).toBe(3);
      expect(customUtils.uid(16).length).toBe(16);
      expect(customUtils.uid(42).length).toBe(42);
      expect(customUtils.uid(1000).length).toBe(1000);
    });

    it('Generated uids should not be the same', function () {
      expect(customUtils.uid(56)).not.toBe(customUtils.uid(56));
    });
  });
});