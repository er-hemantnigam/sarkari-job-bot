const cron = require('node-cron');
const { fetchAllRss } = require('../scraper/rssParser');
const { scrapeAllSites } = require('../scraper/siteScraper');
const { processPendingJobs } = require('../engine/alertSender');
const { runDailyJobs } = require('./dailyJobs');

const safe = (label, fn) => async () => {
  try {
    await fn();
  } catch (err) {
    console.error(`[Cron:${label}] failed:`, err);
  }
};

const startScheduler = () => {
  // Every 5 minutes — push alerts for pending jobs
  cron.schedule('*/5 * * * *', safe('alerts', processPendingJobs));

  // Every 30 minutes — pull RSS feeds
  cron.schedule('*/30 * * * *', safe('rss', fetchAllRss));

  // Every 2 hours — scrape sites (heavier)
  cron.schedule('0 */2 * * *', safe('scrape', scrapeAllSites));

  // Daily at 00:05 IST (UTC+5:30) — counter reset, expiry checks, reminders
  cron.schedule('5 0 * * *', safe('daily', runDailyJobs), {
    timezone: 'Asia/Kolkata'
  });

  console.log('⏱️  Scheduler started:');
  console.log('   - Alerts:  every 5 min');
  console.log('   - RSS:     every 30 min');
  console.log('   - Scrape:  every 2 hours');
  console.log('   - Daily:   00:05 IST');

  // Kick off an initial fetch so we don't wait 30 min on boot
  setTimeout(safe('boot-rss', fetchAllRss), 5_000);
  setTimeout(safe('boot-scrape', scrapeAllSites), 30_000);
};

module.exports = { startScheduler };
