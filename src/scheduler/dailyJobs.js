const bot = require('../bot');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

const DAY_MS = 24 * 60 * 60 * 1000;

const resetDailyCounters = async () => {
  const today = new Date().toISOString().split('T')[0];
  const res = await User.updateMany(
    { lastAlertDate: { $ne: today } },
    { $set: { alertsToday: 0 } }
  );
  console.log(`[Daily] Reset alert counters for ${res.modifiedCount} users.`);
};

const downgradeExpired = async () => {
  const now = new Date();
  const expired = await User.find({
    plan: 'premium',
    expiresAt: { $lte: now }
  });

  for (const user of expired) {
    const prevPlan = user.plan;
    user.plan = 'free';
    user.expiresAt = null;
    await user.save();

    await Subscription.updateMany(
      { telegramId: user.telegramId, status: 'active' },
      { status: 'expired' }
    );

    try {
      await bot.telegram.sendMessage(
        user.telegramId,
        `⚠️ Your *${prevPlan.toUpperCase()}* plan has expired.\n\n` +
          `You've been moved to the free plan. Renew anytime with /subscribe`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[Daily] Could not notify expired user:', err.message);
    }
  }
  console.log(`[Daily] Downgraded ${expired.length} expired users.`);
};

const sendExpiryReminders = async () => {
  const now = new Date();
  const in2Days = new Date(now.getTime() + 2 * DAY_MS);
  const in3Days = new Date(now.getTime() + 3 * DAY_MS);

  const users = await User.find({
    plan: 'premium',
    expiresAt: { $gte: in2Days, $lt: in3Days }
  });

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(
        user.telegramId,
        `⏰ Your *${user.plan.toUpperCase()}* plan expires in 2 days (${new Date(user.expiresAt).toDateString()}).\n\n` +
          `Renew with /subscribe to keep your benefits.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[Daily] Could not send expiry reminder:', err.message);
    }
  }
  console.log(`[Daily] Sent expiry reminders to ${users.length} users.`);
};

const sendLastDateReminders = async () => {
  // Premium-only "last date is tomorrow" reminders for jobs.
  // Job.lastDate is a free-form string (e.g. "15/06/2024"), so we parse loosely.
  const Job = require('../models/Job');
  const { matchesUser } = require('../engine/matcher');

  const parseDate = (s) => {
    if (!s) return null;
    const m = s.match(/(\d{1,2})[\/\-\. ](\d{1,2})[\/\-\. ](\d{2,4})/);
    if (!m) return null;
    let [_, dd, mm, yy] = m;
    if (yy.length === 2) yy = '20' + yy;
    const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  };

  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow.getTime() + DAY_MS);

  const jobs = await Job.find({ lastDate: { $ne: null } }).limit(500);
  const dueJobs = jobs.filter((j) => {
    const d = parseDate(j.lastDate);
    return d && d >= tomorrow && d < dayAfter;
  });

  if (dueJobs.length === 0) {
    console.log('[Daily] No last-date reminders to send.');
    return;
  }

  const premiumUsers = await User.find({
    plan: 'premium',
    isActive: true,
    isPaused: false
  });

  let sent = 0;
  for (const job of dueJobs) {
    for (const user of premiumUsers) {
      if (!matchesUser(user, job)) continue;
      try {
        await bot.telegram.sendMessage(
          user.telegramId,
          `⏰ *Last Date Tomorrow*\n\n` +
            `📌 ${job.title}\n` +
            `📅 Last Date: ${job.lastDate}\n` +
            (job.link ? `🔗 ${job.link}` : ''),
          { parse_mode: 'Markdown', disable_web_page_preview: false }
        );
        sent++;
      } catch (err) {
        console.error('[Daily] last-date reminder failed:', err.message);
      }
    }
  }
  console.log(`[Daily] Sent ${sent} last-date reminders (premium).`);
};

const runDailyJobs = async () => {
  console.log('[Daily] Running daily jobs...');
  await resetDailyCounters();
  await downgradeExpired();
  await sendExpiryReminders();
  await sendLastDateReminders();
  console.log('[Daily] Done.');
};

module.exports = { runDailyJobs };
