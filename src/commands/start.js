const { Markup } = require('telegraf');
const User = require('../models/User');
const { CATEGORIES, PAID_PLANS_ENABLED } = require('../config/constants');

module.exports = (bot) => {
  bot.start(async (ctx) => {
    const { id, username, first_name } = ctx.from;

    await User.findOneAndUpdate(
      { telegramId: id },
      {
        $setOnInsert: {
          telegramId: id,
          username: username || null,
          firstName: first_name || null
        }
      },
      { upsert: true, new: true }
    );


    const categoryText = `👉 Pick categories to start. You can change later with /categories`;
    const planText =
      `📌 *Free plan:* 3 alerts/day, 1 category\n` +
      `⚡ *Basic / Premium:* Faster alerts, unlimited categories\n\n` +
      categoryText;
    const welcome =
      `👋 Welcome ${first_name || ''}!\n\n` +
      `🏛️ *Sarkari Job Alerts Bot*\n` +
      `Get instant notifications for government jobs across India.\n\n` + 
      (PAID_PLANS_ENABLED ? planText : categoryText);

    const buttons = CATEGORIES.map((c) => Markup.button.callback(c, `cat:${c}`));
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });

    await ctx.replyWithMarkdown(welcome, keyboard);
  });

  // Welcome new group members
  bot.on('new_chat_members', async (ctx) => {
    for (const m of ctx.message.new_chat_members) {
      if (m.is_bot) continue;
      await ctx.replyWithMarkdown(
        `👋 Welcome ${m.first_name}! Send me /start in DM to set up your job alerts.`
      );
    }
  });
};
