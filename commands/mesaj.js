const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mesaj')
        .setDescription('Bot tarafından özel çerceve içinde mesaj gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
        .addStringOption(option =>
            option.setName('başlık')
                .setDescription('Mesajın başlığı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('içerik')
                .setDescription('Mesajın içeriği')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('renk')
                .setDescription('Çerçeve rengi (mavi, yeşil, kırmızı, sarı, mor, turuncu)')
                .setRequired(false)
                .addChoices(
                    { name: 'Mavi', value: '#0099FF' },
                    { name: 'Yeşil', value: '#00FF00' },
                    { name: 'Kırmızı', value: '#FF0000' },
                    { name: 'Sarı', value: '#FFFF00' },
                    { name: 'Mor', value: '#9900FF' },
                    { name: 'Turuncu', value: '#FF6600' }
                )),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const baslik = interaction.options.getString('başlık');
        const icerik = interaction.options.getString('içerik');
        const renk = interaction.options.getString('renk') || '#0099FF';

        try {
            const embed = new EmbedBuilder()
                .setTitle(baslik)
                .setDescription(icerik)
                .setColor(renk)
                .setFooter({ text: `Gönderen: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.channel.send({ embeds: [embed] });
            await interaction.editReply({ content: '✅ Mesaj başarıyla gönderildi!' });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ Mesaj gönderilirken hata: ${error.message}` });
        }
    },
};
