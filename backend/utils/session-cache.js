// backend/utils/session-cache.js

// Simple in-memory cache for session personalization
// In production, use Redis
const sessionCache = new Map();

/**
 * Get cached personalization
 * @param {string} userId 
 * @param {string} domain 
 */
const getCachedSession = (userId, domain) => {
  const key = `${userId}_${domain || 'default'}`;
  return sessionCache.get(key);
};

/**
 * Set cached personalization
 * @param {string} userId 
 * @param {string} domain 
 * @param {object} data 
 * @param {number} ttlMs 
 */
const setCachedSession = (userId, domain, data, ttlMs = 30 * 60 * 1000) => {
  const key = `${userId}_${domain || 'default'}`;
  sessionCache.set(key, {
    response: data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
};

/**
 * Invalidate cache for a user
 * @param {string} userId 
 */
const invalidateUserCache = (userId) => {
  // Naive implementation: iterate keys (map size is usually small for this demo)
  // For production with many users, use a better structure or Redis
  for (const key of sessionCache.keys()) {
    if (key.startsWith(`${userId}_`)) {
      sessionCache.delete(key);
      console.log(`[Cache] Invalidated session for ${userId}`);
    }
  }
};

module.exports = {
  sessionCache,
  getCachedSession,
  setCachedSession,
  invalidateUserCache
};
