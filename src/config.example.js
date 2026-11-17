// Copy this file to src/config.js (git-ignored) and fill in your values.
// Firebase console -> Project settings -> Your apps -> Web app -> SDK setup and configuration.
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
};

// Firebase console -> App Check -> Apps -> (your web app) -> Manage debug tokens -> Add debug token.
// Keep this secret: anyone with it can call your Gemini quota.
export const appCheckDebugToken = 'YOUR-APP-CHECK-DEBUG-TOKEN';
