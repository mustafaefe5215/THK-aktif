const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yasakla')
        .setDescription('Bir kullanıcıyı sunucudan yasaklar (geçici).')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Yasaklanacak kullanıcı')
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

            if (!member) {
                return await interaction.editReply({ content: '❌ Kullanıcı sunucuda bulunamadı!' });
            }

            await member.ban({ reason: sebep });

            const embed = new EmbedBuilder()
                .setTitle('⛔ Kullanıcı Yasaklandı')
                .setColor('#FF0000')
                .addFields(
                    { name: '👤 Yasaklanan Kullanıcı', value: `${user.tag}`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Sebep', value: sebep, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Yasaklama işleminde hata: ${error.message}` });
        }
    },
};
