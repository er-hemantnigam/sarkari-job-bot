module.exports = (bot) => {
  bot.command('help', async (ctx) => {
    await ctx.replyWithMarkdown(
      `🤖 *Sarkari Job Bot — Commands*\n\n` +
        `/start — Register & welcome\n` +
        `/categories — Pick job categories (SSC, Railway, Banking…)\n` +
        `/settings — Set state filter & qualification\n` +
        `/myplan — View your plan, expiry & today's alert count\n` +
        `/subscribe — View Basic / Premium plans & upgrade\n` +
        `/pause — Stop receiving alerts\n` +
        `/resume — Start receiving alerts again\n` +
        `/help — Show this message\n\n` +
        `💡 Send your payment screenshot here after /subscribe.`
    );
  });
};
