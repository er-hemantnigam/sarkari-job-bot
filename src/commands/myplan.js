const User = require('../models/User');
const { PLAN_LIMITS } = require('../config/constants');

module.exports = (bot) => {
  bot.command('myplan', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('Please send /start first.');

    const limits = PLAN_LIMITS[user.plan];
    const today = new Date().toISOString().split('T')[0];
    const alertsUsed = user.lastAlertDate === today ? user.alertsToday : 0;

    const dailyLimit = limits.dailyAlerts === Infinity ? 'Unlimited' : limits.dailyAlerts;
    const expiry = user.expiresAt
      ? new Date(user.expiresAt).toDateString()
      : 'Never (free plan)';
    const delay =
      limits.delayMinutes === 0
        ? 'Instant'
        : limits.delayMinutes >= 60
          ? `${limits.delayMinutes / 60} hour(s)`
          : `${limits.delayMinutes} min`;

    await ctx.replyWithMarkdown(
      `📋 *Your Plan*\n\n` +
        `💼 *Plan:* ${user.plan.toUpperCase()}\n` +
        `📅 *Expires:* ${expiry}\n` +
        `⏱️ *Alert delay:* ${delay}\n` +
        `📊 *Alerts today:* ${alertsUsed} / ${dailyLimit}\n` +
        `🔔 *Paused:* ${user.isPaused ? 'Yes' : 'No'}\n\n` +
        `Upgrade with /subscribe`
    );
  });
};
