const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('tamyasakla')
        .setDescription('Bir kullanıcıyı sunucudan kalıcı olarak yasaklar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Kalıcı olarak yasaklanacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Yasaklama sebebi')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        
        const user = interaction.options.getUser('kullanıcı');
        const sebep = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

        try {
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (member) {
                await member.ban({ reason: `[KALICI] ${sebep}` });
            } else {
                await interaction.guild.bans.create(user.id, { reason: `[KALICI] ${sebep}` });
            }

            const embed = new EmbedBuilder()
                .setTitle('🔒 Kullanıcı Kalıcı Olarak Yasaklandı')
                .setColor('#8B0000')
                .addFields(
                    { name: '👤 Yasaklanan Kullanıcı', value: `${user.tag}`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Sebep', value: sebep, inline: false },
                    { name: '⏱️ Süre', value: 'Kalıcı', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Yasaklama işleminde hata: ${error.message}` });
        }
    },
};
