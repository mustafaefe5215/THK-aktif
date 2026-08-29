const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Kullanıcıyı sessize al')
    .addUserOption(option => option.setName('user').setDescription('Sessize alınacak kullanıcı').setRequired(true))
    .addStringOption(option => option.setName('duration').setDescription('Süre (örn: 1h, 30m, 1d)').setRequired(false))
    .addStringOption(option => option.setName('reason').setDescription('Neden').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const duration = interaction.options.getString('duration') || '1h';
    const reason = interaction.options.getString('reason') || 'Belirtilmemiş';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: '❌ Kullanıcı bulunamadı.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: '❌ Kendini sessize alamazsın.', ephemeral: true });
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Yöneticiye işlem uygulayamazsın.', ephemeral: true });
    }

    const timeMap = { 's': 1000, 'm': 60000, 'h': 3600000, 'd': 86400000 };
    let timeout = 0;
    for (const [unit, mult] of Object.entries(timeMap)) {
      const match = duration.match(new RegExp(`(\\d+)${unit}`, 'i'));
      if (match) {
        timeout += parseInt(match[1]) * mult;
      }
    }

    if (timeout === 0) timeout = 3600000; // 1 saat default

    try {
      await member.timeout(timeout, reason);
      await interaction.reply({
        content: `✅ ${member} sessize alındı.\n**Süre:** ${duration}\n**Neden:** ${reason}`,
        ephemeral: false
      });
    } catch (error) {
      console.error('Mute error:', error);
      await interaction.reply({ content: '❌ Sessize alma işlemi başarısız oldu.', ephemeral: true });
    }
  }
};
