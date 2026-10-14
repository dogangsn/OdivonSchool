export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyBroZstYgFlpmg08UHQvnPCWLKAbPkv4qM',
    authDomain: 'odivonschool.firebaseapp.com',
    projectId: 'odivonschool',
    storageBucket: 'odivonschool.firebasestorage.app',
    messagingSenderId: '85105551551',
    appId: '1:85105551551:web:c2903923873dc75862be0a',
    measurementId: 'G-89SQT7XZDL',
  },
  /**
   * Web Push certificate (VAPID) public key: Firebase console → Project
   * settings → Cloud Messaging → Web Push certificates. Empty = browser
   * notifications are not configured (the profile page hides the switch).
   */
  vapidKey: '',
};
