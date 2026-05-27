const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  link:       { type: String, default: null },
  source:     { type: String, required: true },
  category:   { type: String, default: 'Other' },

  // Details extracted from title
  state:      { type: String, default: 'All India' },
  qualification: { type: String, default: 'Any' },
  lastDate:   { type: String, default: null },
  vacancies:  { type: String, default: null },

  // Deduplication
  hash:       { type: String, unique: true, required: true },

  // Alert tracking
  notified:   { type: Boolean, default: false },
  notifiedAt: { type: Date, default: null },
  notifiedUsers: { type: [Number], default: [] }, // telegramIds already sent

  // Meta
  postedAt:   { type: Date, default: null },
  foundAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', JobSchema);
