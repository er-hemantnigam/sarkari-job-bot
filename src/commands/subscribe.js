const { Markup } = require('telegraf');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { PRICES, PAID_PLANS_ENABLED } = require('../config/constants');

const UPI_ID = process.env.UPI_ID || 'your-upi@bank';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

module.exports = (bot) => {
  bot.command('subscribe', async (ctx) => {
    if (!PAID_PLANS_ENABLED) {
      return ctx.replyWithMarkdown(
        `🎉 *Good news — the bot is currently free for everyone!*\n\n` +
          `Enjoy:\n` +
          `  • Unlimited alerts\n` +
          `  • Instant notifications\n` +
          `  • Multiple categories\n\n` +
          `Paid plans will arrive later. For now: pick your categories with /categories and you're set.`
      );
    }

    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('Please send /start first.');

    await ctx.replyWithMarkdown(
      `💎 *Upgrade to Premium*\n\n` +
        `*PREMIUM — ₹${PRICES.premium}/month*\n` +
        `  • Instant alerts\n` +
        `  • Unlimited alerts/day\n` +
        `  • Multiple categories\n` +
        `  • Last-date reminders\n` +
        `  • Admit card alerts\n` +
        `  • Result alerts`,
      Markup.inlineKeyboard([
        [Markup.button.callback(`Get Premium ₹${PRICES.premium}`, 'sub:premium')]
      ])
    );
  });

  bot.action(/^sub:(premium)$/, async (ctx) => {
    if (!PAID_PLANS_ENABLED) return ctx.answerCbQuery('Paid plans are currently disabled.');

    const plan = ctx.match[1];
    const amount = PRICES[plan];

    ctx.session.step = 'awaiting_screenshot';
    ctx.session.pendingPlan = plan;

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `💳 *Payment Instructions*\n\n` +
        `Plan: *${plan.toUpperCase()}* — ₹${amount}\n\n` +
        `1. Pay ₹${amount} to UPI: \`${UPI_ID}\`\n` +
        `2. Take a screenshot of payment\n` +
        `3. Send the screenshot here in this chat\n\n` +
        `Your plan will be activated within a few hours.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('photo', async (ctx) => {
    if (!PAID_PLANS_ENABLED) return;
    if (ctx.session?.step !== 'awaiting_screenshot') return;

    const plan = ctx.session.pendingPlan;
    const amount = PRICES[plan];
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;

    await Subscription.create({
      telegramId: ctx.from.id,
      plan,
      amount,
      screenshotId: fileId,
      status: 'pending'
    });

    ctx.session.step = null;
    ctx.session.pendingPlan = null;

    await ctx.reply(
      '✅ Screenshot received! Your subscription will be activated within a few hours. You will be notified once active.'
    );

    if (ADMIN_CHAT_ID) {
      try {
        await bot.telegram.sendPhoto(ADMIN_CHAT_ID, fileId, {
          caption:
            `💰 *New Payment*\n\n` +
            `User: ${ctx.from.first_name} (@${ctx.from.username || 'no-username'})\n` +
            `Telegram ID: \`${ctx.from.id}\`\n` +
            `Plan: ${plan.toUpperCase()}\n` +
            `Amount: ₹${amount}\n\n` +
            `Activate with: \`/activate ${ctx.from.id}\``,
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Failed to forward screenshot to admin:', err.message);
      }
    }
  });
};
