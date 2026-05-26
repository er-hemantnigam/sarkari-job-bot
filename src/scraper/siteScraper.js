const axios = require('axios');
const cheerio = require('cheerio');
const Job = require('../models/Job');
const { jobHash } = require('../utils/hash');
const { categorizeJob } = require('../engine/categorizer');

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'
};

const safeGet = async (url) => {
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 20000 });
    return data;
  } catch (err) {
    console.error(`[Scrape] GET ${url} failed:`, err.message);
    return null;
  }
};

const absolutize = (href, base) => {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch (_) {
    return href;
  }
};

const scrapeSSC = async () => {
  const url = 'https://ssc.gov.in/home/notice-board';
  const html = await safeGet(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const items = [];

  $('a').each((_, el) => {
    const title = $(el).text().trim().replace(/\s+/g, ' ');
    const href = $(el).attr('href');
    if (!title || title.length < 15) return;
    const lower = title.toLowerCase();
    if (!/(notice|notification|recruit|exam|admit|result|vacanc|advt)/.test(lower)) return;

    items.push({
      title,
      link: absolutize(href, url),
      source: 'ssc.gov.in',
      description: title
    });
  });

  return items.slice(0, 50);
};

const scrapeFreeJobAlert = async () => {
  const url = 'https://www.freejobalert.com/latest-notifications/';
  const html = await safeGet(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const items = [];

  $('table tr td a, .post-content a, article a').each((_, el) => {
    const title = $(el).text().trim().replace(/\s+/g, ' ');
    const href = $(el).attr('href');
    if (!title || title.length < 20) return;
    if (!href || href.startsWith('#')) return;

    items.push({
      title,
      link: absolutize(href, url),
      source: 'freejobalert.com',
      description: title
    });
  });

  const seen = new Set();
  return items.filter((j) => {
    if (seen.has(j.title)) return false;
    seen.add(j.title);
    return true;
  }).slice(0, 60);
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
      if (err.code !== 11000) console.error('[Scrape] save error:', err.message);
    }
  }
  return saved;
};

const scrapeAllSites = async () => {
  console.log('[Scrape] Scraping sites...');
  const [ssc, fja] = await Promise.all([scrapeSSC(), scrapeFreeJobAlert()]);
  const all = [...ssc, ...fja];
  console.log(`[Scrape] Pulled ${ssc.length} SSC + ${fja.length} FreeJobAlert items`);
  const saved = await saveJobs(all);
  console.log(`[Scrape] Saved ${saved} new jobs`);
  return saved;
};

module.exports = { scrapeAllSites, scrapeSSC, scrapeFreeJobAlert };
