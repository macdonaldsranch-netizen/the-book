// Firebase client-side config for project: the-book-mcd
// These values are safe to be in source code — they are public identifiers.
// Security is enforced by Firestore Rules + Firebase Auth on the backend.
//
// Find these values in:
//   Firebase Console → Project Settings → General → Your apps → Web app → firebaseConfig

import { initializeApp } from 'firebase/app';
import { getAuth }       from 'firebase/auth';

const firebaseConfig = {
  apiKey:            "AIzaSyDRNr291B82ij0_qgQcjeTbZDot4F4coko",
  authDomain:        "the-book-mcd.firebaseapp.com",
  projectId:         "the-book-mcd",
  storageBucket:     "the-book-mcd.firebasestorage.app",
  messagingSenderId: "865190098735",
  appId:             "1:865190098735:web:1658994f41030498efd3da",
};

const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export default firebaseApp;
