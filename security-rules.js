const SECURITY_RULES = {
  everyoneHere: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  roleAbuse: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  channelAbuse: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  guildAbuse: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  renameAbuse: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  raidAbuse: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  spamAbuse: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  permissionAbuse: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  webhookAbuse: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  mentionSpam: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  emojiSpam: {
    1: 'warn',
    2: 'remove-role',
    3: 'ban'
  },
  botRaid: {
    1: 'warn',
    2: 'ban',
    3: 'ban'
  },
  suspiciousAccount: {
    1: 'warn',
    2: 'ban',
    3: 'ban'
  }
};

function getAbuseAction(type, count) {
  if (!type || !SECURITY_RULES[type]) {
    if (count >= 3) return { action: 'ban' };
    if (count === 2) return { action: 'remove-role' };
    return { action: 'warn' };
  }

  const action = SECURITY_RULES[type][count] || (count >= 3 ? 'ban' : count === 2 ? 'remove-role' : 'warn');
  return { action };
}

function shouldFlagRapidMessageBurst(timestamps, threshold = 7) {
  if (!Array.isArray(timestamps) || threshold < 3 || timestamps.length < threshold) return false;

  const sorted = [...timestamps].sort((a, b) => a - b);
  const recentWindow = 15000;
  for (let i = 0; i <= sorted.length - threshold; i++) {
    const window = sorted.slice(i, i + threshold);
    const delta = window[window.length - 1] - window[0];
    if (delta <= recentWindow) {
      return true;
    }
  }

  return false;
}

function isDangerousPermissionDelta(oldPerms, newPerms) {
  if (!oldPerms || !newPerms) return false;

  const dangerousPermissions = [
    'Administrator',
    'ManageGuild',
    'ManageRoles',
    'ManageChannels',
    'BanMembers',
    'KickMembers',
    'ManageWebhooks',
    'ManageMessages'
  ];

  for (const permission of dangerousPermissions) {
    const oldVal = oldPerms.has ? oldPerms.has(permission) : false;
    const newVal = newPerms.has ? newPerms.has(permission) : false;
    if (!oldVal && newVal) return true;
  }

  return false;
}

function isSuspiciousWebhookAction(type, action) {
  const suspicious = ['create', 'delete', 'update'];
  return !!(type && action && suspicious.includes(action.toLowerCase()));
}

function shouldFlagRapidGuildBurst(events, threshold = 5, maxWindowMs = 20000) {
  if (!Array.isArray(events) || events.length < threshold) return false;

  const sorted = [...events].sort((a, b) => a - b);
  const window = sorted.slice(-threshold);
  const delta = window[window.length - 1] - window[0];
  return delta <= maxWindowMs;
}

function getEventSummary(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return 'Henüz olay yok.';
  }

  return events.slice(0, 5).map(event => {
    const action = event.action || 'bilinmeyen';
    const label = event.label || 'olay';
    const time = event.time || new Date().toLocaleString('tr-TR');
    return `• ${time} - ${label} (${action})`;
  }).join('\n');
}

function normalizeWhitelist(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[\s,]+/)
    .map(v => v.trim())
    .filter(Boolean);
}

function isWhitelistedId(userId, whitelist) {
  const ids = normalizeWhitelist(whitelist);
  return ids.includes(String(userId));
}

function containsAdvertLink(value) {
  if (!value || typeof value !== 'string') return false;
  const cleaned = value.toLowerCase();
  const suspiciousPatterns = [
    /discord\.gg\//i,
    /discordapp\.com\/invite\//i,
    /https?:\/\//i,
    /www\./i,
    /t\.me\//i,
    /bit\.ly\//i,
    /youtube\.com\//i,
    /instagram\.com\//i,
    /twitter\.com\//i,
    /tiktok\.com\//i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(cleaned));
}

function shouldFlagVoiceBurst(timestamps, threshold = 4, maxWindowMs = 6000) {
  if (!Array.isArray(timestamps) || timestamps.length < threshold) return false;
  const sorted = [...timestamps].sort((a, b) => a - b);
  const window = sorted.slice(-threshold);
  const delta = window[window.length - 1] - window[0];
  return delta <= maxWindowMs;
}

function shouldFlagMentionSpam(content) {
  if (!content || typeof content !== 'string') return false;
  const mentionMatches = (content.match(/<@\d+>/g) || []).length;
  const roleMentions = (content.match(/<@&\d+>/g) || []).length;
  const totalMentions = mentionMatches + roleMentions;
  return totalMentions >= 5;
}

function shouldFlagEmojiSpam(content) {
  if (!content || typeof content !== 'string') return false;
  const emojiPattern = /[\u{1F300}-\u{1F9FF}]|<a?:\w+:\d+>/gu;
  const emojis = (content.match(emojiPattern) || []).length;
  return emojis >= 15;
}

function isSuspiciousAccount(member) {
  if (!member) return false;
  const createdAt = member.user?.createdTimestamp || 0;
  const now = Date.now();
  const ageMs = now - createdAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  
  return ageHours < 1 || ageHours < 24 && !member.user?.verified;
}

function shouldFlagRaidJoins(timestamps, threshold = 10, maxWindowMs = 60000) {
  if (!Array.isArray(timestamps) || timestamps.length < threshold) return false;
  const sorted = [...timestamps].sort((a, b) => a - b);
  const window = sorted.slice(-threshold);
  const delta = window[window.length - 1] - window[0];
  return delta <= maxWindowMs;
}

function containsSpamWords(content) {
  if (!content || typeof content !== 'string') return false;
  const spamPatterns = [
    /free\s*(?:nitro|robux|discord|steam)/i,
    /click\s*(?:here|link|now)/i,
    /verify\s*(?:now|account|here)/i,
    /confirm\s*(?:account|identity|now)/i,
    /earn\s*(?:money|robux|free)/i,
    /hack\s*(?:account|free|here)/i,
    /sex|xxx|porn|nude/i
  ];
  
  return spamPatterns.some(pattern => pattern.test(content));
}

function getSuspiciousNamePatterns(name) {
  if (!name || typeof name !== 'string') return false;
  const suspicious = [
    /^.{1,2}$/,
    /^[0-9]{8,}$/,
    /admin|moderator|owner/i,
    /null|undefined|deleted/i
  ];
  
  return suspicious.some(pattern => pattern.test(name));
}

module.exports = {
  SECURITY_RULES,
  getAbuseAction,
  shouldFlagRapidMessageBurst,
  shouldFlagRapidGuildBurst,
  isDangerousPermissionDelta,
  isSuspiciousWebhookAction,
  getEventSummary,
  normalizeWhitelist,
  isWhitelistedId,
  containsAdvertLink,
  shouldFlagVoiceBurst,
  shouldFlagMentionSpam,
  shouldFlagEmojiSpam,
  isSuspiciousAccount,
  shouldFlagRaidJoins,
  containsSpamWords,
  getSuspiciousNamePatterns
};
