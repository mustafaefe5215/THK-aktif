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
