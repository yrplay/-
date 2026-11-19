import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress internal Firestore transport/WebChannel timeout warning logs while keeping explicit app error handlers active
try {
  setLogLevel('silent');
} catch {
  // ignore
}

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth: Auth = getAuth(app);

const databaseId: string | undefined = (firebaseConfig as any).firestoreDatabaseId || undefined;

function createFirestoreInstance(): Firestore {
  try {
    return databaseId
      ? initializeFirestore(
          app,
          {
            experimentalAutoDetectLongPolling: true,
            ignoreUndefinedProperties: true,
          },
          databaseId
        )
      : initializeFirestore(app, {
          experimentalAutoDetectLongPolling: true,
          ignoreUndefinedProperties: true,
        });
  } catch {
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db: Firestore = createFirestoreInstance();

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch {
    // Gracefully handle connection checks
  }
}
testConnection();

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

// تخزين رمز الوصول في sessionStorage فقط لحمايته من هجمات XSS ومنع بقائه الدائم في المتصفح
const SESSION_KEY_GOOGLE_ACCESS_TOKEN = 'pos_google_access_token_session_v2';
const SESSION_KEY_GOOGLE_TOKEN_EXPIRY = 'pos_google_token_expiry_session_v2';

// تنظيف أي رموز قديمة كانت مخزنة في localStorage من الإصدار السابق
try {
  localStorage.removeItem('pos_google_access_token_v1');
  localStorage.removeItem('pos_google_token_expiry_v1');
} catch {
  // ignore
}

let cachedAccessToken: string | null = null;
try {
  const stored = sessionStorage.getItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN);
  const expiry = sessionStorage.getItem(SESSION_KEY_GOOGLE_TOKEN_EXPIRY);
  if (stored) {
    if (!expiry || Date.now() < Number(expiry)) {
      cachedAccessToken = stored;
    } else {
      sessionStorage.removeItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN);
      sessionStorage.removeItem(SESSION_KEY_GOOGLE_TOKEN_EXPIRY);
    }
  }
} catch {
  // sessionStorage might be unavailable
}

export const initAuth = (
  onAuthChange: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && !user.isAnonymous) {
      if (!cachedAccessToken) {
        try {
          const stored = sessionStorage.getItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN);
          const expiry = sessionStorage.getItem(SESSION_KEY_GOOGLE_TOKEN_EXPIRY);
          if (stored && (!expiry || Date.now() < Number(expiry))) {
            cachedAccessToken = stored;
          }
        } catch {
          // ignore
        }
      }
      onAuthChange(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN);
        sessionStorage.removeItem(SESSION_KEY_GOOGLE_TOKEN_EXPIRY);
      } catch {
        // ignore
      }
      onAuthChange(null, null);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('لم نتمكن من استخراج رمز الوصول من Google');
    }

    cachedAccessToken = credential.accessToken;
    try {
      const expiresInMs = 3500 * 1000;
      sessionStorage.setItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN, cachedAccessToken);
      sessionStorage.setItem(SESSION_KEY_GOOGLE_TOKEN_EXPIRY, (Date.now() + expiresInMs).toString());
    } catch (e) {
      console.warn('Could not persist Google access token to sessionStorage:', e);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN);
      const expiry = sessionStorage.getItem(SESSION_KEY_GOOGLE_TOKEN_EXPIRY);
      if (stored) {
        if (!expiry || Date.now() < Number(expiry)) {
          cachedAccessToken = stored;
        } else {
          cachedAccessToken = null;
          sessionStorage.removeItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN);
          sessionStorage.removeItem(SESSION_KEY_GOOGLE_TOKEN_EXPIRY);
        }
      }
    } catch {
      // ignore
    }
  }
  return cachedAccessToken;
};

export const clearCachedAccessToken = () => {
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN);
    sessionStorage.removeItem(SESSION_KEY_GOOGLE_TOKEN_EXPIRY);
  } catch {
    // ignore
  }
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN, token);
    } else {
      sessionStorage.removeItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN);
    }
  } catch {
    // ignore
  }
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(SESSION_KEY_GOOGLE_ACCESS_TOKEN);
    sessionStorage.removeItem(SESSION_KEY_GOOGLE_TOKEN_EXPIRY);
  } catch {
    // ignore
  }
};
