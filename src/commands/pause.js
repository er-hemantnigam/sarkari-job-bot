const User = require('../models/User');

module.exports = (bot) => {
  bot.command('pause', async (ctx) => {
    const user = await User.findOneAndUpdate(
      { telegramId: ctx.from.id },
      { isPaused: true },
      { new: true }
    );
    if (!user) return ctx.reply('Please send /start first.');
    await ctx.reply('🔕 Alerts paused. Use /resume to start again.');
  });

  bot.command('resume', async (ctx) => {
    const user = await User.findOneAndUpdate(
      { telegramId: ctx.from.id },
      { isPaused: false },
      { new: true }
    );
    if (!user) return ctx.reply('Please send /start first.');
    await ctx.reply('🔔 Alerts resumed!');
  });
};
