const { STATES, QUALIFICATIONS } = require('../config/constants');

const CATEGORY_KEYWORDS = {
  SSC:          ['ssc', 'staff selection', 'chsl', 'cgl', 'mts', 'gd constable', 'stenographer'],
  Railway:      ['railway', 'rrb', 'rrc', 'indian railways', 'ntpc', 'alp', 'group d'],
  Banking:      ['bank', 'ibps', 'sbi', 'rbi', 'nabard', 'sidbi', 'po ', 'clerk', 'po,', 'po.'],
  UPSC:         ['upsc', 'ias', 'ips', 'civil services', 'union public service'],
  Defence:      ['army', 'navy', 'air force', 'iaf', 'defence', 'defense', 'bsf', 'crpf', 'cisf', 'itbp', 'ssb', 'nda', 'cds', 'agniveer', 'agnipath'],
  Teaching:     ['teacher', 'teaching', 'tet', 'ctet', 'professor', 'lecturer', 'kvs', 'nvs', 'dsssb teacher'],
  Police:       ['police', 'constable', 'si ', 'sub inspector', 'sub-inspector', 'home guard'],
  'State PSC':  ['psc', 'mppsc', 'uppsc', 'bpsc', 'rpsc', 'tnpsc', 'kpsc', 'oppsc', 'wbpsc', 'appsc', 'tspsc', 'hpsc', 'jpsc', 'cgpsc'],
  PSU:          ['psu', 'ongc', 'iocl', 'bhel', 'gail', 'ntpc limited', 'sail', 'powergrid', 'hpcl', 'bpcl', 'drdo', 'isro', 'barc', 'cdac']
};

const QUAL_KEYWORDS = {
  '10th':           ['10th', 'matric', 'high school', 'class 10'],
  '12th':           ['12th', 'intermediate', 'higher secondary', 'class 12', '+2'],
  Graduate:         ['graduate', 'graduation', 'bachelor', 'b.a', 'b.com', 'b.sc', 'ba ', 'bsc ', 'bcom ', 'degree'],
  'Post Graduate':  ['post graduate', 'pg ', 'masters', 'm.a', 'm.com', 'm.sc', 'phd'],
  Diploma:          ['diploma'],
  ITI:              ['iti'],
  Engineering:      ['engineer', 'engineering', 'b.tech', 'b.e ', 'btech', 'm.tech', 'mtech']
};

const lower = (s) => (s || '').toLowerCase();

const detectCategory = (title, source = '') => {
  const t = `${lower(title)} ${lower(source)}`;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => t.includes(k))) return cat;
  }
  return 'Other';
};

const detectState = (title) => {
  const t = lower(title);
  for (const state of STATES) {
    if (state === 'All India') continue;
    if (t.includes(state.toLowerCase())) return state;
  }
  return 'All India';
};

const detectQualification = (title) => {
  const t = lower(title);
  for (const [qual, keywords] of Object.entries(QUAL_KEYWORDS)) {
    if (keywords.some((k) => t.includes(k))) return qual;
  }
  return 'Any';
};

const LAST_DATE_RE = /(?:last\s*date|apply\s*by|closing\s*date)[:\s-]*([0-9]{1,2}[\/\-\. ][0-9]{1,2}[\/\-\. ][0-9]{2,4})/i;
const VACANCY_RE = /(\d{2,6})\s*(?:vacanc|posts?|seats?)/i;

const detectLastDate = (text) => {
  const m = (text || '').match(LAST_DATE_RE);
  return m ? m[1] : null;
};

const detectVacancies = (text) => {
  const m = (text || '').match(VACANCY_RE);
  return m ? m[1] : null;
};

const categorizeJob = (job) => {
  const blob = `${job.title || ''} ${job.description || ''}`;
  return {
    ...job,
    category: detectCategory(job.title, job.source),
    state: detectState(job.title),
    qualification: detectQualification(blob),
    lastDate: job.lastDate || detectLastDate(blob),
    vacancies: job.vacancies || detectVacancies(blob)
  };
};

module.exports = {
  categorizeJob,
  detectCategory,
  detectState,
  detectQualification
};
