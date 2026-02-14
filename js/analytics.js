/**
 * analytics.js — GA4 event tracking helper.
 * Uses window.gtag when available; no-op otherwise.
 * Measurement ID lives only in index.html.
 */

const seenKeys = new Set();

/**
 * Send a GA4 event. No-op if gtag is not loaded.
 * @param {string} eventName - GA4 event name
 * @param {Object} [params] - Event parameters (snake_case)
 */
export function track(eventName, params) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params || {});
  }
}

/**
 * Send an event at most once per session for a given key.
 * Used to avoid duplicate events (e.g. same file uploaded twice).
 * @param {string} key - Unique key for this "action" (duplicates share key)
 * @param {string} eventName - GA4 event name
 * @param {Object} [params] - Event parameters
 */
export function trackOnce(key, eventName, params) {
  if (seenKeys.has(key)) return;
  seenKeys.add(key);
  track(eventName, params);
}
