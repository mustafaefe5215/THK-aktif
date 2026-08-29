const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sunucudanat')
        .setDescription('Bir kullanıcıyı sunucudan çıkarır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Çıkarılacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Çıkarma sebebi')
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

            await member.kick(sebep);

            const embed = new EmbedBuilder()
                .setTitle('👢 Kullanıcı Sunucudan Çıkarıldı')
                .setColor('#FF6600')
                .addFields(
                    { name: '👤 Çıkarılan Kullanıcı', value: `${user.tag}`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Sebep', value: sebep, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Çıkarma işleminde hata: ${error.message}` });
        }
    },
};
