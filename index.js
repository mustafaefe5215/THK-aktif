const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// Render / Glitch / Replit için HTTP sunucusu (Render'ın kapanmaması için gereklidir)
http.createServer((req, res) => {
  res.write("Bot aktif!");
  res.end();
}).listen(process.env.PORT || 3000);

// Discord Bot Client Kurulumu
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`${client.user.tag} olarak giriş yapıldı ve aktif!`);
});

// Komut Dinleyici Example
client.on('messageCreate', message => {
  if (message.author.bot) return;

  if (message.content === '!sa' || message.content === 'sa') {
    message.reply('Aleykümselam!');
  }
});

// Bot Tokeni ile Giriş Yapma
client.login(process.env.TOKEN);
