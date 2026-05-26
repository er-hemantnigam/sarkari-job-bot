const crypto = require('crypto');

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();

const jobHash = ({ title, link, source }) => {
  const key = `${normalize(title)}|${normalize(link)}|${normalize(source)}`;
  return crypto.createHash('md5').update(key).digest('hex');
};

module.exports = { jobHash, normalize };
