const { Markup } = require('telegraf');
const User = require('../models/User');
const { STATES, QUALIFICATIONS } = require('../config/constants');

const stateKeyboard = (selected) => {
  const buttons = STATES.map((s) => {
    const mark = selected.includes(s) ? '✅ ' : '';
    return Markup.button.callback(`${mark}${s}`, `st:${s}`);
  });
  return Markup.inlineKeyboard(
    [...buttons, Markup.button.callback('✔️ Done', 'st:done')],
    { columns: 2 }
  );
};

const qualKeyboard = (current) => {
  const buttons = QUALIFICATIONS.map((q) => {
    const mark = current === q ? '✅ ' : '';
    return Markup.button.callback(`${mark}${q}`, `qual:${q}`);
  });
  return Markup.inlineKeyboard(buttons, { columns: 2 });
};

module.exports = (bot) => {
  bot.command('settings', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('Please send /start first.');

    await ctx.reply(
      `⚙️ *Settings*\n\n` +
        `📍 *States:* ${user.states.join(', ')}\n` +
        `🎓 *Qualification:* ${user.qualification}\n\n` +
        `Pick a setting to change:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📍 Change States', 'set:states')],
          [Markup.button.callback('🎓 Change Qualification', 'set:qual')]
        ])
      }
    );
  });

  bot.action('set:states', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📍 Select states (tap to toggle):',
      stateKeyboard(user.states)
    );
  });

  bot.action('set:qual', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    await ctx.editMessageText('🎓 Select your qualification:', qualKeyboard(user.qualification));
  });

  bot.action(/^st:(.+)$/, async (ctx) => {
    const choice = ctx.match[1];
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.answerCbQuery();

    if (choice === 'done') {
      await ctx.answerCbQuery('Saved!');
      return ctx.editMessageText(
        `✅ States saved: ${user.states.join(', ') || 'None'}`
      );
    }

    if (!STATES.includes(choice)) return ctx.answerCbQuery();

    const has = user.states.includes(choice);
    user.states = has
      ? user.states.filter((s) => s !== choice)
      : [...user.states, choice];

    await user.save();
    await ctx.answerCbQuery(has ? `Removed ${choice}` : `Added ${choice}`);
    try {
      await ctx.editMessageReplyMarkup(stateKeyboard(user.states).reply_markup);
    } catch (_) { /* ignore */ }
  });

  bot.action(/^qual:(.+)$/, async (ctx) => {
    const choice = ctx.match[1];
    if (!QUALIFICATIONS.includes(choice)) return ctx.answerCbQuery();

    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.answerCbQuery();

    user.qualification = choice;
    await user.save();
    await ctx.answerCbQuery(`Set to ${choice}`);
    await ctx.editMessageText(`✅ Qualification saved: ${choice}`);
  });
};
