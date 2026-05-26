module.exports = {
  CATEGORIES: [
    'SSC',
    'Railway',
    'Banking',
    'UPSC',
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
    free:    { dailyAlerts: 3,        delayMinutes: 0, multiCategory: false },
    premium: { dailyAlerts: Infinity, delayMinutes: 0, multiCategory: true  }
  },

  PRICES: {
    premium: Number(process.env.PREMIUM_PRICE) || 49
  }
};
