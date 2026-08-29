const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rütbe-sor')
        .setDescription('Roblox grubundaki bir kişinin mevcut rütbesini öğrenin.')
        .addStringOption(option => 
            option.setName('roblox-kullanıcı')
                .setDescription('Bilgisi sorgulanacak Roblox kullanıcı adı')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const robloxUsername = interaction.options.getString('roblox-kullanıcı');
        const groupId = parseInt(process.env.GROUP_ID);

        try {
            // Noblox.js Kimlik Doğrulaması
            const cookie = process.env.ROBLOX_COOKIE;
            if (!cookie) {
                return interaction.editReply({ content: '❌ ROBLOX_COOKIE .env dosyasında tanımlanmamış!' });
            }
            await noblox.setCookie(cookie);

            // 1. Roblox Kullanıcı ID'sini Bul
            const userId = await noblox.getIdFromUsername(robloxUsername);
            if (!userId) {
                return interaction.editReply({ content: `❌ **${robloxUsername}** adında bir Roblox kullanıcısı bulunamadı!` });
            }

            // 2. Grupta Rütbesini Sorgula
            const userRole = await noblox.getRoleInGroup(groupId, userId);
            
            if (userRole === 'Guest') {
                return interaction.editReply({ content: `⚠️ **${robloxUsername}** Roblox grubunda bulunmuyor!` });
            }

            // 3. Tüm Rol Bilgilerini Al
            const groupRoles = await noblox.getRoles(groupId);
            const roleInfo = groupRoles.find(role => role.name === userRole);

            // 4. Sonuç Embedded Mesajı
            const embed = new EmbedBuilder()
                .setTitle('🔍 Rütbe Sorgusu')
                .setColor('#0099FF')
                .addFields(
                    { name: '👤 Oyuncu Adı', value: robloxUsername, inline: true },
                    { name: '🆔 Oyuncu ID', value: `${userId}`, inline: true },
                    { name: '🎖️ Mevcut Rütbe', value: userRole, inline: true },
                    { name: '📊 Rank Numarası', value: `${roleInfo?.rank || 'Bilinmiyor'}`, inline: true }
                )
                .setFooter({ text: 'THK Bot' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: `❌ Sorgu yapılırken bir hata oluştu!\n**Hata Detayı:** \`${error.message}\`` 
            });
        }
    },
};
