const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Kullanıcıyı uyar')
    .addUserOption(option => option.setName('user').setDescription('Uyarılacak kullanıcı').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Neden').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Belirtilmemiş';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: '❌ Kullanıcı bulunamadı.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: '❌ Kendini uyaramazsın.', ephemeral: true });
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Yöneticiye işlem uygulayamazsın.', ephemeral: true });
    }

    try {
      await member.send(`⚠️ **Uyarı**\n\nSunucu: ${interaction.guild.name}\n**Neden:** ${reason}\n\nBir sonraki ihlalde daha ağır cezalar uygulanacaktır.`).catch(() => {});
      
      await interaction.reply({
        content: `⚠️ ${member} kullanıcısı uyarıldı.\n**Neden:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      console.error('Warn error:', error);
      await interaction.reply({ content: '❌ Uyarı işlemi başarısız oldu.', ephemeral: true });
    }
  }
};
