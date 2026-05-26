const bot = require('../bot');
const User = require('../models/User');
const Job = require('../models/Job');
const { matchesUser, isJobReady } = require('./matcher');
const { PLAN_LIMITS } = require('../config/constants');

// Once a job is older than this, no tier can still be waiting on it.
const MAX_DELAY_MINUTES = Math.max(
  ...Object.values(PLAN_LIMITS).map((l) => l.delayMinutes)
);

const escapeMd = (s) =>
  (s || '').replace(/[_*`\[\]()~>#+=|{}.!-]/g, (m) => `\\${m}`);

const formatJobMessage = (job) => {
  const parts = [
    `🔔 *New Job Alert*`,
    ``,
    `📌 *${escapeMd(job.title)}*`,
    `🏷️ Category: ${escapeMd(job.category)}`,
    `📍 State: ${escapeMd(job.state)}`,
    `🎓 Qualification: ${escapeMd(job.qualification)}`
  ];
  if (job.vacancies) parts.push(`👥 Vacancies: ${escapeMd(job.vacancies)}`);
  if (job.lastDate)  parts.push(`📅 Last Date: ${escapeMd(job.lastDate)}`);
  if (job.link)      parts.push(`\n🔗 [Apply / Details](${job.link})`);
  parts.push(`\n_Source: ${escapeMd(job.source)}_`);
  return parts.join('\n');
};

const todayStr = () => new Date().toISOString().split('T')[0];

const sendAlert = async (user, job) => {
  try {
    await bot.telegram.sendMessage(user.telegramId, formatJobMessage(job), {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: false
    });
    return true;
  } catch (err) {
    console.error(
      `[Alert] Failed to send job ${job._id} to ${user.telegramId}:`,
      err.message
    );
    if (err.response?.error_code === 403) {
      user.isActive = false;
      await user.save();
    }
    return false;
  }
};

const incrementUserCount = async (user) => {
  const today = todayStr();
  if (user.lastAlertDate !== today) {
    user.alertsToday = 1;
    user.lastAlertDate = today;
  } else {
    user.alertsToday += 1;
  }
  await user.save();
};

const canSendNow = (user) => {
  if (user.isPaused || !user.isActive) return false;
  const limits = PLAN_LIMITS[user.plan];
  if (limits.dailyAlerts === Infinity) return true;

  const today = todayStr();
  const used = user.lastAlertDate === today ? user.alertsToday : 0;
  return used < limits.dailyAlerts;
};

const processPendingJobs = async () => {
  const jobs = await Job.find({ notified: false }).sort({ foundAt: 1 }).limit(100);
  if (jobs.length === 0) {
    console.log('[Scheduler] No pending jobs.');
    return;
  }

  const users = await User.find({ isActive: true, isPaused: false });
  console.log(`[Scheduler] Processing ${jobs.length} jobs × ${users.length} users`);

  for (const job of jobs) {
    const sentTo = new Set(job.notifiedUsers || []);

    for (const user of users) {
      if (sentTo.has(user.telegramId)) continue;
      if (new Date(job.foundAt) < new Date(user.joinedAt)) continue;
      if (!matchesUser(user, job)) continue;
      if (!isJobReady(user, job)) continue;
      if (!canSendNow(user)) continue;

      const ok = await sendAlert(user, job);
      if (ok) {
        sentTo.add(user.telegramId);
        await incrementUserCount(user);
      }
    }

    job.notifiedUsers = [...sentTo];

    const ageMinutes = (Date.now() - new Date(job.foundAt).getTime()) / 60000;
    if (ageMinutes >= MAX_DELAY_MINUTES) {
      job.notified = true;
      job.notifiedAt = new Date();
    }
    await job.save();
  }
};

module.exports = { processPendingJobs, formatJobMessage, sendAlert };
