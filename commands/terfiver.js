const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('terfiver')
        .setDescription('Roblox grubundaki bir oyuncuyu 1 üst rütbeye yükseltir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option => 
            option.setName('roblox-kullanıcı')
                .setDescription('Terfi edilecek Roblox kullanıcı adı')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('sebep')
                .setDescription('Terfi verme sebebi')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const robloxUsername = interaction.options.getString('roblox-kullanıcı');
        const sebep = interaction.options.getString('sebep');
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

            // 2. Grup Rollerini Al
            const groupRoles = await noblox.getRoles(groupId);
            if (!groupRoles || groupRoles.length === 0) {
                return interaction.editReply({ content: '❌ Grup rollerini alırken bir hata oluştu!' });
            }

            // 3. Kullanıcının Mevcut Rütbesini Çek
            const userRole = await noblox.getRoleInGroup(groupId, userId);
            if (userRole === 'Guest') {
                return interaction.editReply({ content: `❌ **${robloxUsername}** kullanıcısı Roblox grubunda bulunmuyor!` });
            }

            // 4. Mevcut Rütbeyi Ara ve Sonrasını Bul
            const currentRoleIndex = groupRoles.findIndex(role => role.name === userRole);
            if (currentRoleIndex === -1) {
                return interaction.editReply({ content: `❌ Kullanıcının mevcut rütbesi **${userRole}** bulunamadı!` });
            }

            // Maksimum rütbe kontrolü
            if (currentRoleIndex === groupRoles.length - 1) {
                const maxRoleName = groupRoles[groupRoles.length - 1].name;
                return interaction.editReply({ 
                    content: `⚠️ **${robloxUsername}** zaten en yüksek rütbe olan **${maxRoleName}**'te bulunuyor!` 
                });
            }

            // 5. Sonraki Rütbeyi Bul ve Uygula
            const nextRole = groupRoles[currentRoleIndex + 1];
            const newRole = await noblox.setRank(groupId, userId, nextRole.rank);

            // 6. Başarılı Mesajı Gönder
            const embed = new EmbedBuilder()
                .setTitle('✅ Roblox Grup Rütbesi Yükseltildi')
                .setColor('#00FF00')
                .addFields(
                    { name: '👤 Oyuncu', value: `${robloxUsername} (${userId})`, inline: true },
                    { name: '📈 Eski Rütbe', value: `${userRole} (Rank: ${groupRoles[currentRoleIndex].rank})`, inline: true },
                    { name: '⭐ Yeni Rütbe', value: `${newRole.name} (Rank: ${newRole.rank})`, inline: true },
                    { name: '📝 Sebep', value: sebep, inline: false },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: `❌ Terfi verilirken bir hata oluştu!\n**Hata Detayı:** \`${error.message}\`` 
            });
        }
    },
};
