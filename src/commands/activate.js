const User = require('../models/User');
const Subscription = require('../models/Subscription');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

module.exports = (bot) => {
  bot.command('activate', async (ctx) => {
    if (!ADMIN_CHAT_ID || String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
      return ctx.reply('⛔ Admin only.');
    }

    const args = ctx.message.text.split(/\s+/).slice(1);
    if (args.length < 2) {
      return ctx.reply('Usage: /activate <telegramId> <basic|premium> [days=30]');
    }

    const [tgIdStr, plan, daysStr] = args;
    const tgId = Number(tgIdStr);
    const days = Number(daysStr) || 30;

    if (!['basic', 'premium'].includes(plan)) {
      return ctx.reply('Plan must be "basic" or "premium".');
    }
    if (!Number.isFinite(tgId)) {
      return ctx.reply('Invalid telegramId.');
    }

    const user = await User.findOne({ telegramId: tgId });
    if (!user) return ctx.reply(`No user found with telegramId ${tgId}.`);

    const startDate = new Date();
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    user.plan = plan;
    user.expiresAt = endDate;
    await user.save();

    const sub = await Subscription.findOneAndUpdate(
      { telegramId: tgId, status: 'pending', plan },
      { status: 'active', startDate, endDate },
      { sort: { createdAt: -1 }, new: true }
    );

    if (!sub) {
      await Subscription.create({
        telegramId: tgId,
        plan,
        amount: 0,
        status: 'active',
        startDate,
        endDate
      });
    }

    await ctx.reply(
      `✅ Activated ${plan.toUpperCase()} for ${tgId} until ${endDate.toDateString()}`
    );

    try {
      await bot.telegram.sendMessage(
        tgId,
        `🎉 Your *${plan.toUpperCase()}* plan is now active until *${endDate.toDateString()}*!\n\nUse /myplan to see details.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Could not notify user:', err.message);
    }
  });
};
