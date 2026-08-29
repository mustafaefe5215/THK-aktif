const { Client, GatewayIntentBits, Collection } = require('discord.js');
const noblox = require('noblox.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function startRoblox() {
    try {
        const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
        console.log(`Roblox Bot Hesabına Giriş Yapıldı: ${currentUser.UserName} (${currentUser.UserID})`);
    } catch (err) {
        console.error("Roblox Cookie Hatası:", err);
    }
}

client.once('ready', () => {
    console.log(`${client.user.tag} Discord'a bağlandı!`);
    startRoblox();
});

client.login(process.env.DISCORD_TOKEN);
