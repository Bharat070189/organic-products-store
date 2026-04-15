import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Only initialize if API key is present to avoid crash
export const isFirebaseConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null as any;
export const auth = app ? getAuth(app) : null as any;
export const storage = app ? getStorage(app) : null as any;
export const googleProvider = new GoogleAuthProvider();

if (!isFirebaseConfigured) {
  console.warn("Firebase is not configured. Please check your firebase-applet-config.json.");
}
