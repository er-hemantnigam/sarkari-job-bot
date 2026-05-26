const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username:     { type: String, default: null },
  firstName:    { type: String, default: null },

  // Subscription
  plan:         { type: String, enum: ['free', 'premium'], default: 'free' },
  expiresAt:    { type: Date, default: null },

  // Preferences
  categories:   { type: [String], default: ['SSC'] },
  states:       { type: [String], default: ['All India'] },
  qualification:{ type: String, default: 'Any' },

  // Alert settings
  isPaused:     { type: Boolean, default: false },
  alertsToday:  { type: Number, default: 0 },
  lastAlertDate:{ type: String, default: null }, // 'YYYY-MM-DD'

  // Meta
  isActive:     { type: Boolean, default: true },
  joinedAt:     { type: Date, default: Date.now }
});

// Check if subscription is active
UserSchema.methods.isSubscribed = function () {
  if (this.plan === 'free') return false;
  if (!this.expiresAt) return false;
  return new Date(this.expiresAt) > new Date();
};

// Check if user can receive alert (free tier limit)
UserSchema.methods.canReceiveAlert = function () {
  if (this.isPaused) return false;
  if (this.plan !== 'free') return true;

  const today = new Date().toISOString().split('T')[0];

  // Reset counter if new day
  if (this.lastAlertDate !== today) return true;

  return this.alertsToday < 3;
};

module.exports = mongoose.model('User', UserSchema);