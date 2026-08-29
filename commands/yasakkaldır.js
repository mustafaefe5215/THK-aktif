const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yasakkaldır')
        .setDescription('Bir kullanıcının yasaklamasını kaldırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Yasağı kaldırılacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Yasağı kaldırma sebebi')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        
        const user = interaction.options.getUser('kullanıcı');
        const sebep = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

        try {
            const bans = await interaction.guild.bans.fetch();
            if (!bans.has(user.id)) {
                return await interaction.editReply({ content: `❌ ${user.tag} yasaklanmamış!` });
            }

            await interaction.guild.bans.remove(user.id, sebep);

            const embed = new EmbedBuilder()
                .setTitle('✅ Yasak Kaldırıldı')
                .setColor('#00FF00')
                .addFields(
                    { name: '👤 Kullanıcı', value: `${user.tag}`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Sebep', value: sebep, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Yasak kaldırırken hata: ${error.message}` });
        }
    },
};
