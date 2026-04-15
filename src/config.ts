export const API_BASE = window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com')
  ? 'https://ais-pre-par4ol2kmazvjqemr6lejx-127978424473.asia-east1.run.app'
  : (window.location.hostname.includes('run.app') ? '' : 'http://localhost:3000');
