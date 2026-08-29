const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kullanıcıyı sunucudan at')
    .addUserOption(option => option.setName('user').setDescription('Atılacak kullanıcı').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Neden').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Belirtilmemiş';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: '❌ Kullanıcı bulunamadı.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: '❌ Kendini atamazsın.', ephemeral: true });
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Yöneticiye işlem uygulayamazsın.', ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ content: '❌ Bu kullanıcıyı atamazsın (izinler yetersiz).', ephemeral: true });
    }

    try {
      await member.kick(reason);
      await interaction.reply({
        content: `✅ ${user.tag} sunucudan atıldı.\n**Neden:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      console.error('Kick error:', error);
      await interaction.reply({ content: '❌ Atma işlemi başarısız oldu.', ephemeral: true });
    }
  }
};
