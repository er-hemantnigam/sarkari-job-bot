require('dotenv').config();

console.log('[env check]', {
  BOT_TOKEN: process.env.BOT_TOKEN ? 'set' : 'MISSING',
  MONGODB_URI: process.env.MONGODB_URI ? 'set' : 'MISSING',
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID ? 'set' : 'MISSING',
  NODE_ENV: process.env.NODE_ENV || 'unset'
});

const bot = require('./bot');
const connectDB = require('./models/db');
const { startScheduler } = require('./scheduler');

// Import commands
const startCommand = require('./commands/start');
const categoriesCommand = require('./commands/categories');
const settingsCommand = require('./commands/settings');
const subscribeCommand = require('./commands/subscribe');
const myplanCommand = require('./commands/myplan');
const helpCommand = require('./commands/help');
const pauseCommand = require('./commands/pause');
const activateCommand = require('./commands/activate');

// Register commands
startCommand(bot);
categoriesCommand(bot);
settingsCommand(bot);
subscribeCommand(bot);
myplanCommand(bot);
helpCommand(bot);
pauseCommand(bot);
activateCommand(bot);

const start = async () => {
  await connectDB();

  // bot.launch() returns a promise that only resolves on shutdown — do NOT await it
  bot.launch().catch((err) => {
    console.error('Bot launch failed:', err);
    process.exit(1);
  });

  console.log('🤖 Bot is running...');
  startScheduler();
};

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
