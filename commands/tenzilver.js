const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tenzilver')
        .setDescription('Roblox grubundaki bir oyuncuyu 1 alt rütbeye indirger.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option => 
            option.setName('roblox-kullanıcı')
                .setDescription('Tenzili alacak Roblox kullanıcı adı')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('sebep')
                .setDescription('Tenzil verme sebebi')
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

            // 4. Mevcut Rütbeyi Ara ve Öncesini Bul
            const currentRoleIndex = groupRoles.findIndex(role => role.name === userRole);
            if (currentRoleIndex === -1) {
                return interaction.editReply({ content: `❌ Kullanıcının mevcut rütbesi **${userRole}** bulunamadı!` });
            }

            // Minimum rütbe kontrolü
            if (currentRoleIndex === 0) {
                const minRoleName = groupRoles[0].name;
                return interaction.editReply({ 
                    content: `⚠️ **${robloxUsername}** zaten en düşük rütbe olan **${minRoleName}**'te bulunuyor!` 
                });
            }

            // 5. Önceki Rütbeyi Bul ve Uygula
            const previousRole = groupRoles[currentRoleIndex - 1];
            const newRole = await noblox.setRank(groupId, userId, previousRole.rank);

            // 6. Başarılı Mesajı Gönder
            const embed = new EmbedBuilder()
                .setTitle('✅ Roblox Grup Rütbesi İndirildi')
                .setColor('#FFA500')
                .addFields(
                    { name: '👤 Oyuncu', value: `${robloxUsername} (${userId})`, inline: true },
                    { name: '📉 Eski Rütbe', value: `${userRole} (Rank: ${groupRoles[currentRoleIndex].rank})`, inline: true },
                    { name: '⬇️ Yeni Rütbe', value: `${newRole.name} (Rank: ${newRole.rank})`, inline: true },
                    { name: '📝 Sebep', value: sebep, inline: false },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ 
                content: `❌ Tenzil verilirken bir hata oluştu!\n**Hata Detayı:** \`${error.message}\`` 
            });
        }
    },
};
