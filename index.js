require('dotenv').config();
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const express = require('express');
const config = require('./settings.json');

function getEnvOrValue(val) {
  if (typeof val === 'string' && val.startsWith('env:')) {
    return process.env[val.replace('env:', '')] || '';
  }
  return val;
}

const app = express();
app.get('/', (req, res) => res.send('Bot Is Ready'));
app.listen(3000, () => console.log('server started'));

function createBot() {
  console.log('[DEBUG] Creating bot with config:', {
    username: getEnvOrValue(config['bot-account']['username']),
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
    auth: config['bot-account']['type']
  });

  const bot = mineflayer.createBot({
    username: getEnvOrValue(config['bot-account']['username']),
    password: getEnvOrValue(config['bot-account']['password']),
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.on('msmc-device-code', (data) => {
    console.log('\x1b[36m[Microsoft Auth] ACTION REQUIRED!\x1b[0m');
    console.log('Go to this URL in your browser:');
    console.log(`\x1b[33m${data.verificationUri}\x1b[0m`);
    console.log('And enter this code:');
    console.log(`\x1b[32m${data.userCode}\x1b[0m`);
    console.log('After you complete this step, the bot will log in automatically.');
  });

  bot.on('login', () => {
    console.log('[DEBUG] Bot login event fired.');
  });
  bot.on('spawn', () => {
    console.log('[DEBUG] Bot spawn event fired.');
  });
  bot.on('end', (reason) => {
    console.log(`[DEBUG] Bot end event: ${reason}`);
  });
  bot.on('error', (err) => {
    console.log(`[DEBUG] Bot error event: ${err}`);
  });

  bot.loadPlugin(pathfinder);
  bot.once('spawn', () => {
    console.log('[BotLog] Bot joined to the server');
    if (config.utils['auto-auth'].enabled) {
      setTimeout(() => {
        const password = config.utils['auto-auth'].password;
        bot.chat(`/register ${password} ${password}`);
        bot.chat(`/login ${password}`);
      }, 500);
    }
    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages'].messages;
      if (config.utils['chat-messages'].repeat) {
        let i = 0;
        setInterval(() => {
          bot.chat(messages[i]);
          i = (i + 1) % messages.length;
        }, config.utils['chat-messages']['repeat-delay'] * 1000);
      } else {
        messages.forEach(msg => bot.chat(msg));
      }
    }
    if (config.position.enabled) {
      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
    }
    if (config.utils['anti-afk'].enabled && config.utils['anti-afk'].sneak) {
      bot.setControlState('sneak', true);
    }
  });
  bot.on('chat', (username, message) => {
    if (config.utils['chat-log']) {
      console.log(`[ChatLog] <${username}> ${message}`);
    }
  });
  bot.on('goal_reached', () => {
    console.log(`[BotLog] Bot arrived to target location. ${bot.entity.position}`);
  });
  bot.on('death', () => {
    console.log(`[BotLog] Bot has died and respawned at ${bot.entity.position}`);
  });
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    });
  }
  bot.on('kicked', reason => console.log(`[BotLog] Bot was kicked: ${reason}`));
}

createBot();
