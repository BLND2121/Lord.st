// badl xot atwane account daneyt

const http = require('http');
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve the HTML file on the root route
app.get("/", (request, response) => {
  response.sendFile('web.html', { root: __dirname });
});

// Start the server on the specified port
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// Keep the app alive by pinging itself every 280 seconds

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const configFile = 'config.json';

// Load existing configuration
let config = {};
if (fs.existsSync(configFile)) {
  config = JSON.parse(fs.readFileSync(configFile));
}

// Store bot processes to manage them
let botProcesses = {};

// Slash command setup
const commands = [
  new SlashCommandBuilder()
    .setName('add_token')
    .setDescription('Add token and voice channel ID')
    .addStringOption(option =>
      option.setName('token')
        .setDescription('The bot token')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('idvoice')
        .setDescription('The voice channel ID')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('remove_token')
    .setDescription('Remove token and stop bot instance')
    .addStringOption(option =>
      option.setName('token')
        .setDescription('The bot token to remove')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('token_list')
    .setDescription('Send the list of tokens in private chat'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.t); // Replace with your main bot's token

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.id), // Replace with your main bot's client ID
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.once('ready', () => {
  console.log('Main bot is ready!');
});

client.on('interactionCreate', async (interaction) => {
  console.log('Received interaction:', interaction);

  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'add_token') {
    const token = options.getString('token');
    const channelId = options.getString('idvoice');

    console.log(`Received token: ${token}, channelId: ${channelId}`);

    config[token] = { channelId };
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    await interaction.reply(`Token and Channel ID have been saved. Starting new bot instance...`);

    // Spawn a new bot process
    const botProcess = spawn('node', [path.join(__dirname, 'subBot.js'), token, channelId]);
    botProcesses[token] = botProcess;

    botProcess.stdout.on('data', (data) => {
      console.log(`Bot stdout: ${data}`);
    });

    botProcess.stderr.on('data', (data) => {
      console.error(`Bot stderr: ${data}`);
    });

    botProcess.on('close', (code) => {
      console.log(`Bot process exited with code ${code}`);
      delete botProcesses[token];
    });
  } else if (commandName === 'remove_token') {
    const token = options.getString('token');

    if (config[token]) {
      delete config[token];
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

      if (botProcesses[token]) {
        botProcesses[token].kill();
        delete botProcesses[token];
      }

      await interaction.reply(`Token and corresponding bot instance have been removed.`);
    } else {
      await interaction.reply(`Token not found.`);
    }
  } else if (commandName === 'token_list') {
    const user = interaction.user;
    const tokenList = Object.keys(config).join('\n') || 'No tokens available.';
    try {
      await user.send(`Here is the list of tokens:\n${tokenList}`);
      await interaction.reply({ content: 'Token list has been sent to your DMs.', ephemeral: true });
    } catch (error) {
      console.error(`Could not send DM to ${user.tag}.\n`, error);
      await interaction.reply({ content: 'I could not send you a DM. Please check your privacy settings.', ephemeral: true });
    }
  }
});

client.login(process.env.t); // Replace with your main bot's token
