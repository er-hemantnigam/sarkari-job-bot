const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  telegramId:   { type: Number, required: true },
  plan:         { type: String, enum: ['basic', 'premium'], required: true },
  amount:       { type: Number, required: true },  // in rupees

  // Payment details
  paymentMethod:{ type: String, default: 'UPI' },
  paymentRef:   { type: String, default: null },   // UPI transaction ID
  screenshotId: { type: String, default: null },   // Telegram file ID

  // Status
  status: {
    type: String,
    enum: ['pending', 'active', 'expired', 'cancelled'],
    default: 'pending'
  },

  // Dates
  startDate:    { type: Date, default: null },
  endDate:      { type: Date, default: null },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);