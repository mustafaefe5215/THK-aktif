const { Client, GatewayIntentBits, Collection, PermissionFlagsBits, AuditLogEvent, EmbedBuilder } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const noblox = require('noblox.js');
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
  shouldFlagVoiceBurst,
  shouldFlagMentionSpam,
  shouldFlagEmojiSpam,
  isSuspiciousAccount,
  shouldFlagRaidJoins,
  containsSpamWords,
  getSuspiciousNamePatterns
} = require('./security-rules');
require('dotenv').config();

const OWNER_ID = process.env.OWNER_ID || null;
const SECURITY_STATE = new Map();
const SECURITY_SETTINGS = new Map();
const SECURITY_LOGS = new Map();
const MESSAGE_TIMESTAMPS = new Map();
const GUILD_EVENT_TIMESTAMPS = new Map();
const VOICE_EVENT_TIMESTAMPS = new Map();
const MEMBER_JOIN_TIMESTAMPS = new Map();
const WEBHOOK_EVENTS = new Set(['webhookCreate', 'webhookDelete', 'webhookUpdate']);
const SECURITY_WHITELIST = new Set(normalizeWhitelist(process.env.SECURITY_WHITELIST || ''));

const PORT = Number(process.env.PORT || 3000);

// HTTP Sunucusu - Keep-Alive için
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Bot aktif ve çalışıyor.');
});

server.on('error', (error) => {
  console.error('HTTP sunucu hatası:', error);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP keep-alive sunucusu ${PORT} portunda çalışıyor.`);
});

// Periyodik Ping - Her 1 dakikada bir
function pingSelf() {
  const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
    console.log(`🔄 Keep-Alive Ping: ${res.statusCode}`);
    res.resume();
  });

  req.on('error', (error) => {
    console.error('Keep-Alive Ping Error:', error.message);
  });
  
  req.setTimeout(5000);
}

setInterval(pingSelf, 60 * 1000); // 1 dakika

// Discord Bot Client Kurulumu
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  presence: {
    activities: [{ name: 'Sunucuları koruyorum ✨', type: 0 }],
    status: 'online'
  }
});

client.commands = new Collection();

function isSecurityEnabled(guild) {
  if (!guild) return false;
  const config = SECURITY_SETTINGS.get(guild.id) || { enabled: true, logChannelId: null };
  return config.enabled !== false;
}

function isProtectedMember(member) {
  if (!member) return true;
  if (OWNER_ID && member.id === OWNER_ID) return true;
  if (SECURITY_WHITELIST.has(String(member.id))) return true;

  return member.roles?.cache?.some(role => {
    return role.permissions.has(PermissionFlagsBits.Administrator)
      || role.permissions.has(PermissionFlagsBits.ManageGuild)
      || role.permissions.has(PermissionFlagsBits.ManageRoles)
      || role.permissions.has(PermissionFlagsBits.ManageChannels)
      || role.permissions.has(PermissionFlagsBits.BanMembers)
      || role.permissions.has(PermissionFlagsBits.KickMembers);
  }) || false;
}

function getSecurityData(userId) {
  if (!SECURITY_STATE.has(userId)) {
    SECURITY_STATE.set(userId, { everyoneHere: 0, roleAbuse: 0, channelAbuse: 0, spamAbuse: 0, permissionAbuse: 0, webhookAbuse: 0, raidAbuse: 0 });
  }
  return SECURITY_STATE.get(userId);
}

function recordGuildEvent(guildId, timestamp) {
  if (!guildId) return;
  const list = GUILD_EVENT_TIMESTAMPS.get(guildId) || [];
  list.push(timestamp);
  GUILD_EVENT_TIMESTAMPS.set(guildId, list.slice(-15));
}

function getRemovableRole(member) {
  if (!member || !member.roles?.cache) return null;

  return member.roles.cache
    .filter(role => role.editable && !role.managed && !role.permissions.has(PermissionFlagsBits.Administrator))
    .sort((a, b) => b.position - a.position)
    .first() || null;
}

async function getSecurityLogChannel(guild) {
  if (!guild) return null;

  let config = SECURITY_SETTINGS.get(guild.id);
  if (!config) {
    const category = guild.channels.cache.find(channel => channel.type === 4 && channel.name.toLowerCase().includes('güvenlik'));
    let logsChannel = guild.channels.cache.find(channel => channel.type === 0 && channel.name.toLowerCase() === 'security-logs');

    if (!logsChannel) {
      const createdCategory = category || await guild.channels.create({
        name: '🔒 Güvenlik',
        type: 4,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      }).catch(() => null);

      logsChannel = await guild.channels.create({
        name: 'security-logs',
        type: 0,
        parent: createdCategory?.id,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: guild.members.me?.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      }).catch(() => null);
    }

    if (!logsChannel) return null;

    config = { enabled: true, logChannelId: logsChannel.id };
    SECURITY_SETTINGS.set(guild.id, config);
  }

  return guild.channels.cache.get(config.logChannelId) || await guild.channels.fetch(config.logChannelId).catch(() => null);
}

function recordSecurityEvent(guildId, event) {
  if (!guildId) return;
  const logs = SECURITY_LOGS.get(guildId) || [];
  logs.unshift({
    ...event,
    time: event.time || new Date().toLocaleString('tr-TR')
  });
  SECURITY_LOGS.set(guildId, logs.slice(0, 25));
}

async function sendSecurityStatusEmbed(guild, author, actionLabel = 'Durum') {
  const config = SECURITY_SETTINGS.get(guild.id) || { enabled: true, logChannelId: null };
  const channel = await getSecurityLogChannel(guild);
  const logs = SECURITY_LOGS.get(guild.id) || [];

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Güvenlik Paneli')
    .setColor(config.enabled ? 0x27ae60 : 0xe67e22)
    .setDescription(`Durum: ${config.enabled ? 'AKTİF' : 'PASİF'}\nKomut: ${actionLabel}`)
    .addFields(
      { name: 'Log Kanalı', value: channel ? channel.toString() : 'Oluşturulmadı', inline: true },
      { name: 'Olay Sayısı', value: String(logs.length), inline: true },
      { name: 'Son Olaylar', value: getEventSummary(logs) || 'Henüz olay yok.', inline: false }
    )
    .setTimestamp();

  if (channel) {
    await channel.send({ embeds: [embed] }).catch(() => {});
  }

  if (author) {
    await author.send({ embeds: [embed] }).catch(() => {});
  }
}

async function logSecurityEvent(guild, member, label, reason, action) {
  const channel = await getSecurityLogChannel(guild);
  const entry = {
    label,
    reason: reason || 'Bilinmeyen',
    action: action || 'warn',
    time: new Date().toLocaleString('tr-TR')
  };
  recordSecurityEvent(guild.id, entry);

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔒 Güvenlik Olayı')
    .setColor(action === 'ban' ? 0xe74c3c : action === 'remove-role' ? 0xf39c12 : 0xf1c40f)
    .setDescription(`Kullanıcı: ${member ? member.toString() : 'Bilinmeyen'}\nEtiket: ${label}\nNeden: ${reason || 'Bilinmeyen'}\nAksiyon: ${action}`)
    .addFields(
      { name: 'Sunucu', value: guild.name, inline: true },
      { name: 'Zaman', value: entry.time, inline: true },
      { name: 'Son Olaylar', value: getEventSummary(SECURITY_LOGS.get(guild.id) || []), inline: false }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function initializeSecurityMode(guild, author) {
  const config = SECURITY_SETTINGS.get(guild.id) || { enabled: true, logChannelId: null };
  const logChannel = await getSecurityLogChannel(guild);

  if (!logChannel) {
    if (author) {
      return author.send('❌ Güvenlik kurulumu için log kanalı oluşturulamadı. Yetkileri kontrol et.').catch(() => {});
    }
    return;
  }

  config.enabled = true;
  config.logChannelId = logChannel.id;
  SECURITY_SETTINGS.set(guild.id, config);

  recordSecurityEvent(guild.id, {
    label: 'Güvenlik modu açıldı',
    reason: 'Bot güvenlik kurulumu başlatıldı',
    action: 'warn',
    time: new Date().toLocaleString('tr-TR')
  });

  if (author) {
    await sendSecurityStatusEmbed(guild, author, 'açıldı');
  }
}

async function applySecurityPenalty(member, type, label, reason) {
  if (!member || !member.guild || !isSecurityEnabled(member.guild) || isProtectedMember(member)) return;

  const data = getSecurityData(member.id);
  data[type] = (data[type] || 0) + 1;
  const count = data[type];
  const action = getAbuseAction(type, count).action;

  try {
    if (action === 'warn') {
      const warning = `⚠️ ${label} davranışı tespit edildi. Bu eylem sunucuda izin verilmiyor.\n\n1. uyarı: Uyarıya rağmen devam ederseniz rol alınacak.\n2. uyarı: En yüksek uygun rol geri alınacak.\n3. uyarı: Kalıcı ban.`;
      await member.send(warning).catch(() => {});
      await member.guild.systemChannel?.send({ content: `⚠️ ${member} kullanıcısı ${label} nedeniyle uyarıldı.` }).catch(() => {});
      await logSecurityEvent(member.guild, member, label, reason || label, 'warn');
      return;
    }

    if (action === 'remove-role') {
      const removableRole = getRemovableRole(member);
      if (removableRole) {
        await member.roles.remove(removableRole).catch(() => {});
      }

      await member.send(`⚠️ ${label} nedeniyle 2. ihlal tespit edildi. En yüksek uygun rol alındı. Bir sonraki ihlalde kalıcı ban.`).catch(() => {});
      await logSecurityEvent(member.guild, member, label, reason || label, 'remove-role');
      return;
    }

    if (action === 'ban') {
      await member.ban({ reason: `Güvenlik sistemi: ${reason || label} - kalıcı ban` }).catch(() => {});
      await member.send(`🚫 ${label} nedeniyle otomatik olarak kalıcı ban yediniz. Bu sunucudan yasaklandınız.`).catch(() => {});
      await logSecurityEvent(member.guild, member, label, reason || label, 'ban');
    }
  } catch (error) {
    console.error(`Security penalty error (${type}):`, error);
  }
}

async function handleAuditAbuse(guild, type, label, reason) {
  try {
    const auditType = type === 'roleCreate' ? AuditLogEvent.RoleCreate
      : type === 'roleDelete' ? AuditLogEvent.RoleDelete
      : type === 'roleUpdate' ? AuditLogEvent.RoleUpdate
      : type === 'channelCreate' ? AuditLogEvent.ChannelCreate
      : type === 'channelDelete' ? AuditLogEvent.ChannelDelete
      : type === 'channelUpdate' ? AuditLogEvent.ChannelUpdate
      : type === 'guildUpdate' ? AuditLogEvent.GuildUpdate
      : AuditLogEvent.ChannelDelete;

    const logs = await guild.fetchAuditLogs({ type: auditType, limit: 1 });
    const entry = logs.entries.first();
    if (!entry || !entry.executorId) return;

    const member = await guild.members.fetch(entry.executorId).catch(() => null);
    if (!member) return;
    if (isProtectedMember(member)) return;

    const abuseType = type === 'roleCreate' || type === 'roleDelete' || type === 'roleUpdate' ? 'roleAbuse'
      : type === 'channelCreate' || type === 'channelDelete' || type === 'channelUpdate' ? 'channelAbuse'
      : 'guildAbuse';

    await applySecurityPenalty(member, abuseType, label, reason || label);
  } catch (error) {
    console.error(`Audit abuse error (${type}):`, error);
  }
}

// Komutları Yükle
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
    console.log(`✅ Komut yüklendi: ${command.data.name}`);
}

client.once('ready', async () => {
  console.log(`${client.user.tag} olarak giriş yapıldı ve aktif!`);
  console.log(`Bot ${client.guilds.cache.size} sunucuda aktif`);

  for (const guild of client.guilds.cache.values()) {
    SECURITY_SETTINGS.set(guild.id, { enabled: true, logChannelId: SECURITY_SETTINGS.get(guild.id)?.logChannelId || null });
    await initializeSecurityMode(guild, null).catch(() => {});
  }
});

// Slash Komut ve Autocomplete Dinleyici
client.on('interactionCreate', async interaction => {
  // Autocomplete İşleyici
  if (interaction.isAutocomplete()) {
    const { commandName, options } = interaction;

    if (commandName === 'rütbe-ver' && options.getFocused(true).name === 'rütbe') {
      try {
        const cookie = process.env.ROBLOX_COOKIE;
        if (!cookie) {
          return interaction.respond([]);
        }

        await noblox.setCookie(cookie);
        const groupId = parseInt(process.env.GROUP_ID);
        const groupRoles = await noblox.getRoles(groupId);

        if (!groupRoles || groupRoles.length === 0) {
          return interaction.respond([]);
        }

        const focusedValue = options.getFocused();
        const filtered = groupRoles
          .filter(role => {
            const label = `${role.name} (${role.rank})`;
            return label.toLowerCase().includes(focusedValue.toLowerCase());
          })
          .slice(0, 25) // Discord 25 limit
          .map(role => ({
            name: `${role.name} (Rank: ${role.rank})`,
            value: role.name
          }));

        await interaction.respond(filtered);
      } catch (error) {
        console.error('Autocomplete hatası:', error);
        await interaction.respond([]);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Komut bulunamadı: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: '❌ Komut çalıştırılırken hata oluştu!', ephemeral: true });
  }
});

// Mesaj Dinleyici
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  if (!isSecurityEnabled(message.guild)) return;

  if (message.content === '!sa' || message.content === 'sa') {
    message.reply('Aleykümselam!');
  }

  if (message.content.toLowerCase().startsWith('.güvenlik') && message.member && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const args = message.content.trim().split(/\s+/).slice(1).map(arg => arg.toLowerCase());
    const action = args[0] || 'durum';
    const config = SECURITY_SETTINGS.get(message.guild.id) || { enabled: true, logChannelId: null };

    if (action === 'aç' || action === 'aktif' || action === 'on') {
      config.enabled = true;
      SECURITY_SETTINGS.set(message.guild.id, config);
      await initializeSecurityMode(message.guild, message.author);
      return;
    }

    if (action === 'kapat' || action === 'pasif' || action === 'off') {
      config.enabled = false;
      SECURITY_SETTINGS.set(message.guild.id, config);
      await sendSecurityStatusEmbed(message.guild, message.author, 'kapatıldı');
      return;
    }

    if (action === 'temizle' || action === 'clear') {
      SECURITY_LOGS.set(message.guild.id, []);
      await sendSecurityStatusEmbed(message.guild, message.author, 'temizlendi');
      return;
    }

    if (action === 'log' || action === 'kanal') {
      await initializeSecurityMode(message.guild, message.author);
      return;
    }

    if (action === 'whitelist' || action === 'beyazliste') {
      const ids = args.slice(1).join(' ');
      const normalized = normalizeWhitelist(ids);
      normalized.forEach(id => SECURITY_WHITELIST.add(String(id)));
      await message.reply({ content: `✅ Beyaz liste güncellendi: ${[...SECURITY_WHITELIST].slice(-5).join(', ') || 'boş'}` });
      return;
    }

    await sendSecurityStatusEmbed(message.guild, message.author, 'durum');
    return;
  }

  if (isProtectedMember(message.member)) return;

  // Spam kelime filtresi
  if (containsSpamWords(message.content)) {
    try {
      await message.delete().catch(() => {});
      await applySecurityPenalty(message.member, 'spamAbuse', 'spam kelime / uygunsuz içerik', 'spam kelime / uygunsuz içerik');
    } catch (error) {
      console.error('Spam word filter error:', error);
    }
  }

  const guildWindow = GUILD_EVENT_TIMESTAMPS.get(message.guild.id) || [];
  guildWindow.push(Date.now());
  GUILD_EVENT_TIMESTAMPS.set(message.guild.id, guildWindow.slice(-10));

  if (shouldFlagRapidGuildBurst(GUILD_EVENT_TIMESTAMPS.get(message.guild.id), 5, 20000)) {
    await applySecurityPenalty(message.member, 'raidAbuse', 'sunucu raid / çoklu hızlı olay', 'sunucu raid / çoklu hızlı olay');
    GUILD_EVENT_TIMESTAMPS.delete(message.guild.id);
  }

  if (message.content.includes('@everyone') || message.content.includes('@here')) {
    try {
      await message.delete().catch(() => {});
      await applySecurityPenalty(message.member, 'everyoneHere', '@everyone / @here spam', '@everyone / @here spam');
    } catch (error) {
      console.error('Message security error:', error);
    }
  }

  // Mention spam kontrolü
  if (shouldFlagMentionSpam(message.content)) {
    try {
      await message.delete().catch(() => {});
      await applySecurityPenalty(message.member, 'mentionSpam', 'aşırı mention spam', 'aşırı mention spam');
    } catch (error) {
      console.error('Mention spam error:', error);
    }
  }

  // Emoji spam kontrolü
  if (shouldFlagEmojiSpam(message.content)) {
    try {
      await message.delete().catch(() => {});
      await applySecurityPenalty(message.member, 'emojiSpam', 'aşırı emoji spam', 'aşırı emoji spam');
    } catch (error) {
      console.error('Emoji spam error:', error);
    }
  }

  if (containsAdvertLink(message.content)) {
    try {
      await message.delete().catch(() => {});
      await applySecurityPenalty(message.member, 'webhookAbuse', 'reklam / link paylaşımı', 'reklam / link paylaşımı');
    } catch (error) {
      console.error('Link security error:', error);
    }
  }

  if (!message.member || isProtectedMember(message.member)) return;

  const memberKey = message.author.id;
  const timestamps = MESSAGE_TIMESTAMPS.get(memberKey) || [];
  timestamps.push(Date.now());
  MESSAGE_TIMESTAMPS.set(memberKey, timestamps.slice(-15));

  if (shouldFlagRapidMessageBurst(MESSAGE_TIMESTAMPS.get(memberKey), 7)) {
    await applySecurityPenalty(message.member, 'spamAbuse', 'hızlı spam / flood', 'hızlı spam / flood');
    MESSAGE_TIMESTAMPS.delete(memberKey);
  }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (!newMember || isProtectedMember(newMember)) return;

  const oldPerms = oldMember.permissions;
  const newPerms = newMember.permissions;

  if (isDangerousPermissionDelta(oldPerms, newPerms)) {
    await applySecurityPenalty(newMember, 'permissionAbuse', 'yetki artırma / izin değişimi', 'yetki artırma / izin değişimi');
  }
});

// Raid koruması - Hızlı katılım tespiti
client.on('guildMemberAdd', async member => {
  if (!member || !member.guild || isProtectedMember(member)) return;

  if (!isSecurityEnabled(member.guild)) return;

  // Şüpheli hesap tespiti
  if (isSuspiciousAccount(member)) {
    try {
      await member.send('⚠️ Hesabınız çok yeni veya doğrulanmamış. Lütfen Discord ayarlarından hesabınızı doğrulayın.').catch(() => {});
      await applySecurityPenalty(member, 'suspiciousAccount', 'şüpheli / yeni hesap katılışı', 'şüpheli / yeni hesap');
    } catch (error) {
      console.error('Suspicious account check error:', error);
    }
  }

  // Raid join tespiti
  const joinTimestamps = MEMBER_JOIN_TIMESTAMPS.get(member.guild.id) || [];
  joinTimestamps.push(Date.now());
  MEMBER_JOIN_TIMESTAMPS.set(member.guild.id, joinTimestamps.slice(-15));

  if (shouldFlagRaidJoins(joinTimestamps, 10, 60000)) {
    try {
      await member.send('🚫 Sunucunuzda çok sayıda hızlı katılım tespit edildi. Acil durum modu aktive edildi!').catch(() => {});
      await logSecurityEvent(member.guild, member, 'raid join tespiti', 'hızlı katılım saldırısı', 'warn');
      recordSecurityEvent(member.guild.id, {
        label: 'RAID UYARISI',
        reason: '10 üye 1 dakikada katıldı',
        action: 'system',
        time: new Date().toLocaleString('tr-TR')
      });
    } catch (error) {
      console.error('Raid join error:', error);
    }
  }
});

client.on('webhookUpdate', async (channel) => {
  const guild = channel.guild;
  const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 1 }).catch(() => null);
  const entry = auditLogs?.entries?.first();
  if (!entry || !entry.executorId) return;

  const member = await guild.members.fetch(entry.executorId).catch(() => null);
  if (!member || isProtectedMember(member)) return;

  await applySecurityPenalty(member, 'webhookAbuse', 'webhook oluşturma / değişim', 'webhook oluşturma / değişim');
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!newState.member || isProtectedMember(newState.member)) return;

  const memberId = newState.member.id;
  const times = VOICE_EVENT_TIMESTAMPS.get(memberId) || [];
  times.push(Date.now());
  VOICE_EVENT_TIMESTAMPS.set(memberId, times.slice(-10));

  if (!newState.channelId || newState.channelId === oldState.channelId) return;

  if (shouldFlagVoiceBurst(VOICE_EVENT_TIMESTAMPS.get(memberId), 4, 6000)) {
    await applySecurityPenalty(newState.member, 'raidAbuse', 'seste durma / hızlı kanal değişimi', 'seste durma / hızlı kanal değişimi');
    VOICE_EVENT_TIMESTAMPS.delete(memberId);
  }
});

client.on('guildRoleCreate', async role => {
  const guild = role.guild;
  recordGuildEvent(guild.id, Date.now());
  await handleAuditAbuse(guild, 'roleCreate', 'rol oluşturma', 'rol oluşturma');
});

client.on('guildRoleDelete', async role => {
  const guild = role.guild;
  recordGuildEvent(guild.id, Date.now());
  await handleAuditAbuse(guild, 'roleDelete', 'rol silme', 'rol silme');
});

client.on('guildRoleUpdate', async (oldRole, newRole) => {
  if (oldRole.name !== newRole.name) {
    await handleAuditAbuse(newRole.guild, 'roleUpdate', 'rol adı değiştirme', 'rol adı değiştirme');
  }
});

client.on('channelCreate', async channel => {
  const guild = channel.guild;
  recordGuildEvent(guild.id, Date.now());
  await handleAuditAbuse(guild, 'channelCreate', 'kanal oluşturma', 'kanal oluşturma');
});

client.on('channelDelete', async channel => {
  const guild = channel.guild;
  recordGuildEvent(guild.id, Date.now());
  await handleAuditAbuse(guild, 'channelDelete', 'kanal silme', 'kanal silme');
});

client.on('guildBanAdd', async ban => {
  const guild = ban.guild;
  recordGuildEvent(guild.id, Date.now());
  const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 }).catch(() => null);
  const entry = logs?.entries?.first();
  if (!entry || !entry.executorId) return;

  const member = await guild.members.fetch(entry.executorId).catch(() => null);
  if (!member || isProtectedMember(member)) return;

  await applySecurityPenalty(member, 'raidAbuse', 'yasaklama / hızlı ban saldırısı', 'yasaklama / hızlı ban saldırısı');
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
  if (oldChannel.name !== newChannel.name) {
    await handleAuditAbuse(newChannel.guild, 'channelUpdate', 'kanal adı değiştirme', 'kanal adı değiştirme');
  }
});

client.on('guildUpdate', async (oldGuild, newGuild) => {
  if (oldGuild.name !== newGuild.name) {
    await handleAuditAbuse(newGuild, 'guildUpdate', 'sunucu adı değiştirme', 'sunucu adı değiştirme');
  }
});

// Hata İşleyiciler
client.on('error', (error) => {
  console.error('❌ Discord client hatası:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord uyarısı:', warning);
});

client.on('disconnect', (event) => {
  console.warn('⚠️ Discord bağlantısı koptu. Yeniden bağlanılacak...', event?.code || 'bilinmeyen');
});

client.on('reconnecting', () => {
  console.log('🔄 Discord yeniden bağlanıyor...');
});

// Giriş Fonksiyonu
async function loginBot() {
  try {
    console.log('🚀 Bot Discord\'a bağlanıyor...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot başarıyla giriş yaptı.');
  } catch (error) {
    console.error('❌ Discord giriş hatası:', error.message);
    console.log('⏳ 10 saniye sonra yeniden deneme...');
    setTimeout(loginBot, 10 * 1000);
  }
}

// Beklenmeyen Hataları Yakala
process.on('uncaughtException', (error) => {
  console.error('❌ Beklenmeyen hata:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('📴 SIGINT alındı. Bot kapatılıyor...');
  client.destroy();
  server.close(() => {
    console.log('✅ Sunucu kapatıldı.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('📴 SIGTERM alındı. Bot kapatılıyor...');
  client.destroy();
  server.close(() => {
    console.log('✅ Sunucu kapatıldı.');
    process.exit(0);
  });
});

// Botu Başlat
loginBot();

