const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Yasaklı kullanıcıyı kaldır')
    .addStringOption(option => option.setName('userid').setDescription('Yasaklı kullanıcının ID\'si').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Neden').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'Belirtilmemiş';

    try {
      await interaction.guild.bans.remove(userId, reason);
      await interaction.reply({
        content: `✅ Kullanıcı yasak kaldırıldı.\n**Neden:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      console.error('Unban error:', error);
      await interaction.reply({ content: '❌ Yasak kaldırma işlemi başarısız oldu.', ephemeral: true });
    }
  }
};
