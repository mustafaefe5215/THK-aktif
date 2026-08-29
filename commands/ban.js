const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Kullanıcıyı sunucudan yasakla')
    .addUserOption(option => option.setName('user').setDescription('Yasaklanacak kullanıcı').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Neden').setRequired(false))
    .addIntegerOption(option => option.setName('days').setDescription('Mesajları sil (0-7 gün)').setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Belirtilmemiş';
    const days = interaction.options.getInteger('days') || 0;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (member && member.id === interaction.user.id) {
      return interaction.reply({ content: '❌ Kendini yasaklayamazsın.', ephemeral: true });
    }

    if (member && member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Yöneticiye işlem uygulayamazsın.', ephemeral: true });
    }

    try {
      await interaction.guild.bans.create(user.id, { reason, deleteMessageDays: days });
      await interaction.reply({
        content: `🚫 ${user.tag} sunucudan kalıcı olarak yasaklandı.\n**Neden:** ${reason}\n**Silinen mesajlar:** ${days} gün`,
        ephemeral: false
      });
    } catch (error) {
      console.error('Ban error:', error);
      await interaction.reply({ content: '❌ Yasaklama işlemi başarısız oldu.', ephemeral: true });
    }
  }
};
