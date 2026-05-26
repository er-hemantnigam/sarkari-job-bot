require('dotenv').config();
const { Telegraf, session } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Session middleware for temporary data storage
bot.use(session({
  defaultSession: () => ({
    step: null,
    pendingPlan: null
  })
}));

module.exports = bot;