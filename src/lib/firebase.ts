import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
  Auth,
} from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth: Auth = getAuth(app);

// Use explicit firestoreDatabaseId if configured
export const db: Firestore = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

// Test Firestore connection on boot as required by system skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    // Gracefully handle any connection errors without unhandled rejection
  }
}
testConnection();

// Ensure the client has an active authenticated Firebase user session
export const ensureAuthSession = async (): Promise<User | null> => {
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    return auth.currentUser;
  }
  try {
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }
  } catch {
    // ignore
  }
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    return auth.currentUser;
  }
  return null;
};

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory and persist in localStorage for Google Sheets & Drive API operations
const STORAGE_KEY_GOOGLE_ACCESS_TOKEN = 'pos_google_access_token_v1';
const STORAGE_KEY_GOOGLE_TOKEN_EXPIRY = 'pos_google_token_expiry_v1';

let cachedAccessToken: string | null = null;
try {
  const stored = localStorage.getItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN);
  const expiry = localStorage.getItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
  if (stored) {
    if (!expiry || Date.now() < Number(expiry)) {
      cachedAccessToken = stored;
    } else {
      localStorage.removeItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
    }
  }
} catch (e) {
  // localStorage might be unavailable or restricted
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthChange: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && !user.isAnonymous) {
      if (!cachedAccessToken) {
        try {
          const stored = localStorage.getItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN);
          const expiry = localStorage.getItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
          if (stored && (!expiry || Date.now() < Number(expiry))) {
            cachedAccessToken = stored;
          }
        } catch (e) {
          // ignore
        }
      }
      onAuthChange(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      try {
        localStorage.removeItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
      } catch (e) {
        // ignore
      }
      onAuthChange(null, null);
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('لم نتمكن من استخراج رمز الوصول من Google');
    }

    cachedAccessToken = credential.accessToken;
    try {
      const expiresInMs = 3500 * 1000; // ~1 hour validity
      localStorage.setItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN, cachedAccessToken);
      localStorage.setItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY, (Date.now() + expiresInMs).toString());
    } catch (e) {
      console.warn('Could not persist Google access token to localStorage:', e);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN);
      const expiry = localStorage.getItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
      if (stored) {
        if (!expiry || Date.now() < Number(expiry)) {
          cachedAccessToken = stored;
        } else {
          cachedAccessToken = null;
          localStorage.removeItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN);
          localStorage.removeItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return cachedAccessToken;
};

export const clearCachedAccessToken = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEY_GOOGLE_TOKEN_EXPIRY);
  } catch (e) {
    // ignore
  }
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN);
    }
  } catch (e) {
    // ignore
  }
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY_GOOGLE_ACCESS_TOKEN);
  } catch (e) {
    // ignore
  }
};
