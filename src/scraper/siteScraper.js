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
    return new URL(href.trim(), base).toString();
  } catch (_) {
    return href.trim();
  }
};

const cleanText = (s) => (s || '').replace(/\s+/g, ' ').trim();

const buildSscAttachmentUrl = (notice) => {
  if (notice.redirectUrl) {
    return absolutize(notice.redirectUrl, 'https://ssc.gov.in/');
  }

  const attachment = notice.attachments?.[0];
  if (!attachment?.path) return null;

  const path = attachment.path.replace(/\\/g, '/').replace(/^\/+/, '');
  return `https://ssc.gov.in/api/attachment/${encodeURI(path)}`;
};

const findSectionBox = ($, headingText) =>
  $('div#heading a')
    .filter((_, el) => cleanText($(el).text()).toLowerCase() === headingText.toLowerCase())
    .first()
    .closest('div[id^="box"]');

const extractSectionLinks = ($, url, headingText, section, limit = 40) => {
  const box = findSectionBox($, headingText);
  if (box.length === 0) return [];

  const items = [];
  box.find('div#post')
    .first()
    .find('a')
    .each((_, el) => {
      const title = cleanText($(el).text());
      const href = $(el).attr('href');
      if (!title || title.length < 10 || !href) return;

      items.push({
        title,
        link: absolutize(href, url),
        source: `sarkariresult.com - ${section}`,
        description: `${section}: ${title}`
      });
    });

  return items.slice(0, limit);
};

const scrapeSarkariResult = async () => {
  const url = 'https://www.sarkariresult.com/';
  const html = await safeGet(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  return [
    ...extractSectionLinks($, url, 'Result', 'Result'),
    ...extractSectionLinks($, url, 'Admit Card', 'Admit Card'),
    ...extractSectionLinks($, url, 'Latest Jobs', 'Latest Jobs')
  ];
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

const scrapeSscNoticeBoard = async () => {
  const url = 'https://ssc.gov.in/api/general-website/portal/records';
  const params = {
    page: 1,
    limit: 20,
    contentType: 'notice-boards',
    key: 'createdAt',
    order: 'DESC',
    isPaginationRequired: true,
    isAttachment: true,
    language: 'english',
    attributes: 'id,headline,examId,contentType,startDate,endDate,language,createdAt'
  };

  try {
    const { data } = await axios.get(url, { headers: HEADERS, params, timeout: 20000 });
    const notices = Array.isArray(data?.data) ? data.data : [];

    return notices
      .map((notice) => {
        const title = cleanText(notice.headline);
        if (!title) return null;

        const attachment = notice.attachments?.[0];
        const link = buildSscAttachmentUrl(notice);
        const fileSize = attachment?.size
          ? ` (${(attachment.size / 1024).toFixed(2)} KB)`
          : '';

        return {
          title,
          link,
          source: 'ssc.gov.in - Notice Board',
          description: `SSC Notice Board: ${title}${fileSize}`,
          lastDate: notice.endDate || null,
          postedAt: notice.createdAt ? new Date(notice.createdAt) : null
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[Scrape] SSC notice board failed:', err.message);
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
            postedAt: tagged.postedAt,
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
  const [sarkariResult, fja, sscNoticeBoard] = await Promise.all([
    scrapeSarkariResult(),
    scrapeFreeJobAlert(),
    scrapeSscNoticeBoard()
  ]);
  const all = [...sarkariResult, ...fja, ...sscNoticeBoard];
  console.log(
    `[Scrape] Pulled ${sarkariResult.length} SarkariResult + ${fja.length} FreeJobAlert + ${sscNoticeBoard.length} SSC Notice Board items`
  );
  const saved = await saveJobs(all);
  console.log(`[Scrape] Saved ${saved} new jobs`);
  return saved;
};

module.exports = {
  scrapeAllSites,
  scrapeSarkariResult,
  scrapeFreeJobAlert,
  scrapeSscNoticeBoard
};
