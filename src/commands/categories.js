const { Markup } = require('telegraf');
const User = require('../models/User');
const { CATEGORIES, PLAN_LIMITS } = require('../config/constants');

const buildKeyboard = (selected) => {
  const buttons = CATEGORIES.map((c) => {
    const mark = selected.includes(c) ? '✅ ' : '';
    return Markup.button.callback(`${mark}${c}`, `cat:${c}`);
  });
  return Markup.inlineKeyboard(
    [...buttons, Markup.button.callback('✔️ Done', 'cat:done')],
    { columns: 2 }
  );
};

module.exports = (bot) => {
  bot.command('categories', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('Please send /start first.');

    await ctx.reply(
      '📂 Select your job categories (tap to toggle):',
      buildKeyboard(user.categories || [])
    );
  });

  bot.action(/^cat:(.+)$/, async (ctx) => {
    const choice = ctx.match[1];
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.answerCbQuery('Please send /start first.');

    if (choice === 'done') {
      await ctx.answerCbQuery('Saved!');
      return ctx.editMessageText(
        `✅ Categories saved: ${user.categories.join(', ') || 'None'}\n\n` +
          `Next: set state & qualification with /settings`
      );
    }

    if (!CATEGORIES.includes(choice)) return ctx.answerCbQuery();

    const has = user.categories.includes(choice);
    const multi = PLAN_LIMITS[user.plan].multiCategory;

    if (has) {
      user.categories = user.categories.filter((c) => c !== choice);
    } else {
      if (!multi) {
        user.categories = [choice];
      } else {
        user.categories.push(choice);
      }
    }

    await user.save();
    await ctx.answerCbQuery(has ? `Removed ${choice}` : `Added ${choice}`);

    try {
      await ctx.editMessageReplyMarkup(buildKeyboard(user.categories).reply_markup);
    } catch (_) {
      /* ignore "message is not modified" */
    }
  });
};
