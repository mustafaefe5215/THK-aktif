const assert = require('node:assert');

const { isBotProcessActive } = require('../bot-manager.js');

assert.strictEqual(isBotProcessActive(null), false);
assert.strictEqual(isBotProcessActive(undefined), false);
assert.strictEqual(isBotProcessActive({ killed: false }), true);
assert.strictEqual(isBotProcessActive({ killed: true }), false);

console.log('bot-manager health checks passed');
