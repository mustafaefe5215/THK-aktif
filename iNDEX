const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, disconnect } = require('@discordjs/voice');
const http = require('http');

// 7/24 açık kalması için basit web sunucusu
http.createServer((req, res) => res.end('Bot Aktif!')).listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const TOKEN = process.env.DISCORD_TOKEN; // Token'ı güvenli tutmak için ortama ekleyeceğiz
const KOMUT = '!sestedur';

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(KOMUT)) return;

    const channel = message.member.voice.channel;
    if (!channel) return message.reply('Önce bir ses kanalına katılmalısın!');

    // Ses kanalına bağlan ve bağlantıyı koparma
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true, // Botun kulaklığını kapatır (Sunucu performansını korur)
    });

    // Otomatik kopmaları engellemek için yeniden bağlanma kontrolü
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                new Promise(resolve => connection.once(VoiceConnectionStatus.Signalling, resolve)),
                new Promise(resolve => connection.once(VoiceConnectionStatus.Connecting, resolve)),
            ]);
        } catch (error) {
            connection.destroy();
        }
    });

    message.reply('Bot ses kanalına girdi ve hiç çıkmayacak şekilde sabitlendi!');
});

client.login(TOKEN);
