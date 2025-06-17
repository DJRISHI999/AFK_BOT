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
app.listen(3000);

function createBot() {
  const bot = mineflayer.createBot({
    username: getEnvOrValue(config['bot-account']['username']),
    password: getEnvOrValue(config['bot-account']['password']),
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);
  bot.once('spawn', () => {
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

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    });
    bot.on('kicked', () => {
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    });
  }

  // Anti-AFK actions
  if (config.utils['anti-afk'] && config.utils['anti-afk'].enabled) {
    setInterval(() => {
      if (bot.entity && bot.entity.position) {
        const actions = [
          () => bot.setControlState('jump', true),
          () => bot.setControlState('jump', false),
          () => bot.setControlState('left', true),
          () => bot.setControlState('left', false),
          () => bot.setControlState('right', true),
          () => bot.setControlState('right', false),
          () => bot.setControlState('forward', true),
          () => bot.setControlState('forward', false),
          () => bot.look(Math.random() * Math.PI * 2, 0)
        ];
        const action = actions[Math.floor(Math.random() * actions.length)];
        action();
      }
    }, 10000);
  }
}

createBot();
