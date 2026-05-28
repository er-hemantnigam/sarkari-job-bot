const PAID_PLANS_ENABLED = String(process.env.PAID_PLANS_ENABLED).toLowerCase() === 'true';

// Free tier when paid is OFF = unlimited (everyone gets premium-equivalent).
// Free tier when paid is ON = the actual restricted free plan.
const FREE_LIMITS = PAID_PLANS_ENABLED
  ? { dailyAlerts: 3,        delayMinutes: 0, multiCategory: false }
  : { dailyAlerts: Infinity, delayMinutes: 0,   multiCategory: true  };

module.exports = {
  PAID_PLANS_ENABLED,

  CATEGORIES: [
    'SSC',
    'Railway',
    'Banking',
    'UPSC',
    'NTA',
    'Defence',
    'Teaching',
    'Police',
    'State PSC',
    'PSU',
    'Other'
  ],

  STATES: [
    'All India',
    'Delhi',
    'Uttar Pradesh',
    'Bihar',
    'Maharashtra',
    'Madhya Pradesh',
    'Rajasthan',
    'Gujarat',
    'Karnataka',
    'Tamil Nadu',
    'Telangana',
    'Andhra Pradesh',
    'Kerala',
    'West Bengal',
    'Odisha',
    'Punjab',
    'Haryana',
    'Jharkhand',
    'Chhattisgarh',
    'Assam',
    'Himachal Pradesh',
    'Uttarakhand',
    'Jammu and Kashmir'
  ],

  QUALIFICATIONS: [
    'Any',
    '10th',
    '12th',
    'Graduate',
    'Post Graduate',
    'Diploma',
    'ITI',
    'Engineering'
  ],

  PLAN_LIMITS: {
    free:    FREE_LIMITS,
    premium: { dailyAlerts: Infinity, delayMinutes: 0, multiCategory: true }
  },

  PRICES: {
    premium: Number(process.env.PREMIUM_PRICE) || 49
  }
};
