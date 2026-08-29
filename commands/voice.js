const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Botu bir ses kanalına katıştırır ve orada aktif tutar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Botu katılmasını istediğiniz ses kanalı')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)),

    async execute(interaction) {
        const channel = interaction.options.getChannel('kanal');

        try {
            await interaction.deferReply();

            // Voice kanalına bağlan
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            // Sessiz audio stream oluştur
            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                },
            });

            // Sessiz PCM veri gönder (opus codec)
            const { Readable } = require('stream');
            const silentStream = new Readable({
                read() {
                    // Her 20ms'de sessiz frame gönder
                    this.push(Buffer.alloc(3840, 0));
                }
            });

            try {
                const resource = createAudioResource(silentStream, { 
                    inputType: 'arbitrary',
                });
                player.play(resource);
            } catch (e) {
                console.log('Audio Resource Error:', e.message);
            }

            connection.subscribe(player);

            // Connection events
            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log(`✅ Bot ${channel.name} kanalına başarıyla katıldı.`);
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                console.log(`Bot ${channel.name} kanalından ayrıldı.`);
            });

            const embed = new EmbedBuilder()
                .setTitle('🎤 Bot Ses Kanalına Katıldı')
                .setColor('#00FF00')
                .addFields(
                    { name: '📻 Kanal', value: `${channel.name}`, inline: true },
                    { name: '🆔 Kanal ID', value: `${channel.id}`, inline: true },
                    { name: '✅ Durum', value: 'Aktif ve Bağlı', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Voice Command Error:', error);
            await interaction.editReply({ 
                content: `❌ Ses kanalına katılırken hata: ${error.message}` 
            });
        }
    },
};
