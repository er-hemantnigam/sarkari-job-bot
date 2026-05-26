const { PLAN_LIMITS } = require('../config/constants');

const matchesCategory = (user, job) => {
  if (!user.categories || user.categories.length === 0) return false;
  return user.categories.includes(job.category);
};

const matchesState = (user, job) => {
  if (!user.states || user.states.length === 0) return true;
  if (job.state === 'All India') return true;
  if (user.states.includes('All India')) return true;
  return user.states.includes(job.state);
};

const matchesQualification = (user, job) => {
  if (!user.qualification || user.qualification === 'Any') return true;
  if (!job.qualification || job.qualification === 'Any') return true;
  return user.qualification === job.qualification;
};

const matchesUser = (user, job) => {
  if (!matchesCategory(user, job)) return false;

  // Free tier: category match only — skip state/qualification filtering
  if (user.plan === 'free') return true;

  if (!matchesState(user, job)) return false;
  if (!matchesQualification(user, job)) return false;
  return true;
};

const isJobReady = (user, job) => {
  const limits = PLAN_LIMITS[user.plan];
  if (limits.delayMinutes === 0) return true;
  const ageMs = Date.now() - new Date(job.foundAt).getTime();
  return ageMs >= limits.delayMinutes * 60 * 1000;
};

module.exports = {
  matchesUser,
  matchesCategory,
  matchesState,
  matchesQualification,
  isJobReady
};
