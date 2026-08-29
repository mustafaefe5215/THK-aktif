const assert = require('node:assert');
const {
  getAbuseAction,
  shouldFlagRapidMessageBurst,
  shouldFlagRapidGuildBurst,
  isDangerousPermissionDelta,
  isSuspiciousWebhookAction,
  getEventSummary,
  normalizeWhitelist,
  isWhitelistedId,
  containsAdvertLink,
  shouldFlagVoiceBurst
} = require('../security-rules.js');

assert.deepStrictEqual(getAbuseAction('everyoneHere', 1), { action: 'warn' });
assert.deepStrictEqual(getAbuseAction('everyoneHere', 2), { action: 'remove-role' });
assert.deepStrictEqual(getAbuseAction('everyoneHere', 3), { action: 'ban' });
assert.deepStrictEqual(getAbuseAction('roleAbuse', 2), { action: 'remove-role' });
assert.deepStrictEqual(getAbuseAction('channelAbuse', 3), { action: 'ban' });
assert.deepStrictEqual(getAbuseAction('raidAbuse', 2), { action: 'remove-role' });

assert.strictEqual(shouldFlagRapidMessageBurst([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000], 7), true);
assert.strictEqual(shouldFlagRapidMessageBurst([1000, 4000, 9000], 2), false);
assert.strictEqual(shouldFlagRapidGuildBurst([1000, 2000, 3000, 4000, 5000, 6000], 5, 20000), true);
assert.strictEqual(shouldFlagRapidGuildBurst([1000, 10000, 20000], 3, 2000), false);
assert.strictEqual(isDangerousPermissionDelta({ has: () => false }, { has: () => true }), true);
assert.strictEqual(isDangerousPermissionDelta({ has: () => true }, { has: () => true }), false);
assert.strictEqual(isSuspiciousWebhookAction('message', 'message'), false);
assert.strictEqual(isSuspiciousWebhookAction('create', 'create'), true);
assert.deepStrictEqual(normalizeWhitelist('123,456, 789'), ['123', '456', '789']);
assert.strictEqual(isWhitelistedId('456', ['123', '456']), true);
assert.strictEqual(containsAdvertLink('discord.gg/abcd'), true);
assert.strictEqual(containsAdvertLink('güzel sunucu burada https://example.com'), true);
assert.strictEqual(containsAdvertLink('merhaba arkadaşlar'), false);
assert.strictEqual(shouldFlagVoiceBurst([1000, 2000, 3000, 4000, 5000], 4, 6000), true);
assert.strictEqual(getEventSummary([{ label: 'spam', action: 'warn', time: '01:00' }, { label: 'ban', action: 'ban', time: '01:01' }]).includes('spam'), true);

console.log('security-rules checks passed');
