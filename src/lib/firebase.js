// Shared Firebase setup: one app, App Check and Remote Config for every SignSense page.

import { initializeApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';
import { getRemoteConfig, fetchAndActivate } from 'firebase/remote-config';
import { firebaseConfig, appCheckDebugToken } from '../config.js';

// Chrome extensions cannot load reCAPTCHA (remote scripts are blocked in MV3),
// so App Check runs with a debug token, which the hackathon rules accept.
// For production you would swap CustomProvider for a token minted by your own backend.
if (appCheckDebugToken) self.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken;

export const app = initializeApp(firebaseConfig);
initializeAppCheck(app, {
  provider: new CustomProvider({
    getToken: () => Promise.reject(new Error('Production App Check provider not configured; set appCheckDebugToken in src/config.js')),
  }),
  isTokenAutoRefreshEnabled: true,
});

// Remote Config: tune behaviour without shipping a new build.
export const RC_DEFAULTS = {
  quick_mode: 'prefer_on_device', // prefer_on_device | only_on_device | only_in_cloud | prefer_in_cloud
  quick_cloud_model: 'gemini-3.5-flash-lite',
  deep_cloud_model: 'gemini-3.8-flash',
  deep_check_enabled: true,
  community_reports_enabled: true,
  community_warn_at: 1, // reports needed to show a warning
  community_danger_at: 3, // reports needed to mark the request high risk
};
export const rc = getRemoteConfig(app);
rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
rc.defaultConfig = RC_DEFAULTS;
export const rcReady = fetchAndActivate(rc).catch((e) => console.warn('[SignSense] Remote Config fetch failed, using defaults', e));
