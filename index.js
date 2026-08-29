const { Client, GatewayIntentBits, Collection } = require('discord.js');
const noblox = require('noblox.js');
require('dotenv').config();
const { REST, Routes } = require('discord.js'); require(dotenv').config();

const commands = \[

require('./commands/rutbe-ver').data.toJSON(),

\];const commands = \[

require('./commands/rutbe-ver').data.toJSON(),

\];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD\_TOKEN);

(async () =\> {

try {

console.log('Slash komutları yükleniyor...'); await rest.put(

Routes.applicationCommands(process.env.CLIENT\_ID), { body: commands },

console.

} catch

console.

}

})0;

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
