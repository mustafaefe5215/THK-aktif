const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kişisorgu')
        .setDescription('Roblox kullanıcısının tüm gruplardaki bilgilerini görün.')
        .addStringOption(option => 
            option.setName('roblox-kullanıcı')
                .setDescription('Bilgisi sorgulanacak Roblox kullanıcı adı')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const robloxUsername = interaction.options.getString('roblox-kullanıcı');

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

            // 2. Kullanıcının Tüm Gruplarını Al
            const userGroups = await noblox.getGroups(userId);
            
            if (!userGroups || userGroups.length === 0) {
                return interaction.editReply({ content: `ℹ️ **${robloxUsername}** herhangi bir gruba üye değildir!` });
            }

            // 3. Sonuçları Düzenle
            let groupList = '';
            let primaryGroup = null;

            for (const group of userGroups) {
                const groupInfo = await noblox.getGroup(group.id);
                const roleInfo = await noblox.getRoleInGroup(group.id, userId);
                
                const groupEntry = `**${groupInfo.name}** (ID: ${group.id})\n└─ Rütbe: ${roleInfo}\n`;
                
                if (group.isPrimary) {
                    primaryGroup = groupEntry;
                } else {
                    groupList += groupEntry;
                }
            }

            // 4. Embed Mesaj Oluştur
            let description = '';
            
            if (primaryGroup) {
                description += '⭐ **Birincil Grup:**\n' + primaryGroup;
            }
            
            if (groupList) {
                description += '\n📋 **Diğer Gruplar:**\n' + groupList;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🔍 ${robloxUsername} - Grup Sorgusu`)
                .setColor('#00FF00')
                .setDescription(description || 'Grup bulunamadı')
                .addFields(
                    { name: '🆔 Oyuncu ID', value: `${userId}`, inline: true },
                    { name: '👥 Toplam Grup Sayısı', value: `${userGroups.length}`, inline: true }
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
