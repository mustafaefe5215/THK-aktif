const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rütbe-ver')
        .setDescription('Roblox grubundaki bir oyuncunun rütbesini değiştirir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) // Sadece yetkililer kullansın
        .addStringOption(option => 
            option.setName('roblox-kullanıcı')
                .setDescription('Rütbe verilecek Roblox kullanıcı adı')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('rütbe')
                .setDescription('Verilecek Roblox grup rütbe adı veya Rank numarası (Örn: 1, 255 veya Subay)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('sebep')
                .setDescription('Rütbe verme sebebi')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply(); // İşlem Roblox API sürdüğü için yanıtı bekletiyoruz

        const robloxUsername = interaction.options.getString('roblox-kullanıcı');
        const targetRank = interaction.options.getString('rütbe');
        const sebep = interaction.options.getString('sebep');
        const groupId = parseInt(process.env.GROUP_ID);

        try {
            // 1. Roblox Kullanıcı ID'sini Bul
            const userId = await noblox.getIdFromUsername(robloxUsername);
            if (!userId) {
                return interaction.editReply({ content: `❌ **${robloxUsername}** adında bir Roblox kullanıcısı bulunamadı!` });
            }

            // 2. Kullanıcının Mevcut Rütbesini Çek
            const currentRankName = await noblox.getRoleInGroup(groupId, userId);
            if (currentRankName === 'Guest') {
                return interaction.editReply({ content: `❌ **${robloxUsername}** kullanıcısı Roblox grubunda bulunmuyor!` });
            }

            // 3. Rütbeyi Değiştir (İster Rütbe Adı, ister Rank ID verilsin)
            let newRole;
            if (!isNaN(targetRank)) {
                // Sayı girildiyse (Rank ID: 1-255 arası)
                newRole = await noblox.setRank(groupId, userId, parseInt(targetRank));
            } else {
                // İsim girildiyse (Örn: "Zabit")
                newRole = await noblox.setRole(groupId, userId, targetRank);
            }

            // 4. Başarılı Mesajı Gönder
            const embed = new EmbedBuilder()
                .setTitle('✅ Roblox Grup Rütbesi Güncellendi')
                .setColor('#00FF00')
                .addFields(
                    { name: '👤 Oyuncu', value: `${robloxUsername} (${userId})`, inline: true },
                    { name: '🎖️ Yeni Rütbe', value: `${newRole.name} (Rank: ${newRole.rank})`, inline: true },
                    { name: '📝 Sebep', value: sebep, inline: false },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: `❌ Rütbe verilirken bir hata oluştu!\n**Olası Nedenler:**\n- Bot hesabının grupta rütbe verme yetkisi yoktur.\n- Girdiğiniz rütbe ismi/numarası grupta mevcut değildir.\n- Hata Detayı: \`${error.message}\`` 
            });
        }
    },
};
