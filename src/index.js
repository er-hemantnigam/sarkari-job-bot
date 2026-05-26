require('dotenv').config();
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
  await bot.launch();
  console.log('🤖 Bot is running...');
  startScheduler();
};

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
