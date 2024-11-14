const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  GuildMember,
} = require("discord.js");
const { Player, QueryType } = require("discord-player");
const config = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
  ],
});

// Set up the player
const player = new Player(client, {
  ffmpeg: "C:/ffmpeg/bin/ffmpeg.exe", // Replace with the correct path if different
});

// When bot is online
client.on("ready", () => {
  console.log("Bot is online!");
  client.user.setActivity({
    name: "🎶 | Music Time",
    type: "LISTENING",
  });
});

client.on("error", console.error);
client.on("warn", console.warn);

// Slash command deployment handler
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!client.application?.owner) await client.application?.fetch();

  if (
    message.content === "!deploy" &&
    message.author.id === client.application?.owner?.id
  ) {
    const commands = [
      new SlashCommandBuilder()
        .setName("play")
        .setDescription("Plays a song from youtube")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("The song you want to play")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip to the current song"),
      new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop the player"),
    ];

    console.log("Deploy command received!");
    await message.guild.commands.set(commands);
    await message.reply("Deployed!");
  }
});

// Interaction Create Event
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand() || !interaction.guildId) return;

  if (
    !(interaction.member instanceof GuildMember) ||
    !interaction.member.voice.channel
  ) {
    return interaction.reply({
      content: "You are not in a voice channel!",
      ephemeral: true,
    });
  }

  if (
    interaction.guild.me.voice.channelId &&
    interaction.member.voice.channelId !== interaction.guild.me.voice.channelId
  ) {
    return interaction.reply({
      content: "You are not in my voice channel!",
      ephemeral: true,
    });
  }

  // Play command
  if (interaction.commandName === "play") {
    await interaction.deferReply();

    const query = interaction.options.getString("query");
    const searchResult = await player
      .search(query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO,
      })
      .catch(() => {});

    if (!searchResult || !searchResult.tracks.length) {
      return interaction.followUp({ content: "No results were found!" });
    }

    const queue = await player.createQueue(interaction.guild, {
      metadata: interaction.channel,
    });

    try {
      if (!queue.connection)
        await queue.connect(interaction.member.voice.channel);
    } catch {
      player.deleteQueue(interaction.guildId);
      return interaction.followUp({
        content: "Could not join your voice channel!",
      });
    }

    await interaction.followUp({
      content: `⏱ | Loading your ${
        searchResult.playlist ? "playlist" : "track"
      }...`,
    });
    searchResult.playlist
      ? queue.addTracks(searchResult.tracks)
      : queue.addTrack(searchResult.tracks[0]);
    if (!queue.playing) await queue.play();
  }
  // Skip command
  else if (interaction.commandName === "skip") {
    await interaction.deferReply();
    const queue = player.getQueue(interaction.guildId);
    if (!queue || !queue.playing)
      return interaction.followUp({
        content: "❌ | No music is being played!",
      });

    const currentTrack = queue.current;
    const success = queue.skip();
    return interaction.followUp({
      content: success
        ? `✅ | Skipped **${currentTrack}**!`
        : "❌ | Something went wrong!",
    });
  }
  // Stop command
  else if (interaction.commandName === "stop") {
    await interaction.deferReply();
    const queue = player.getQueue(interaction.guildId);
    if (!queue || !queue.playing)
      return interaction.followUp({
        content: "❌ | No music is being played!",
      });

    queue.destroy();
    return interaction.followUp({ content: "🛑 | Stopped the player!" });
  }
  // Unknown command
  else {
    interaction.reply({
      content: "Unknown command!",
      ephemeral: true,
    });
  }
});

client.login(config.token);
