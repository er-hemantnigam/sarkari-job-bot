const Parser = require('rss-parser');
const Job = require('../models/Job');
const { jobHash } = require('../utils/hash');
const { categorizeJob } = require('../engine/categorizer');

const parser = new Parser({ timeout: 20000 });

const FEEDS = [
  { url: 'https://www.rojgarresult.com/feed/',   source: 'rojgarresult' },
  { url: 'https://www.govtjobsdiary.com/feed/',  source: 'govtjobsdiary' },
  { url: 'https://www.freejobalert.com/feed/',   source: 'freejobalert' },
  { url: 'https://www.indiajoblive.com/feed/',   source: 'indiajoblive' }
];

const fetchFeed = async ({ url, source }) => {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).map((item) => ({
      title: (item.title || '').trim(),
      link: item.link || null,
      source,
      description: item.contentSnippet || item.content || ''
    }));
  } catch (err) {
    console.error(`[RSS] ${source} failed:`, err.message);
    return [];
  }
};

const saveJobs = async (rawJobs) => {
  let saved = 0;
  for (const raw of rawJobs) {
    if (!raw.title) continue;
    const hash = jobHash(raw);
    const tagged = categorizeJob(raw);

    try {
      const res = await Job.updateOne(
        { hash },
        {
          $setOnInsert: {
            title: tagged.title,
            link: tagged.link,
            source: tagged.source,
            category: tagged.category,
            state: tagged.state,
            qualification: tagged.qualification,
            lastDate: tagged.lastDate,
            vacancies: tagged.vacancies,
            hash,
            foundAt: new Date()
          }
        },
        { upsert: true }
      );
      if (res.upsertedCount > 0) saved++;
    } catch (err) {
      if (err.code !== 11000) console.error('[RSS] save error:', err.message);
    }
  }
  return saved;
};

const fetchAllRss = async () => {
  console.log('[RSS] Fetching feeds...');
  const all = (await Promise.all(FEEDS.map(fetchFeed))).flat();
  console.log(`[RSS] Pulled ${all.length} items from ${FEEDS.length} feeds`);
  const saved = await saveJobs(all);
  console.log(`[RSS] Saved ${saved} new jobs`);
  return saved;
};

module.exports = { fetchAllRss, FEEDS };
