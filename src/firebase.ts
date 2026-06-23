import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configura o provedor Google Auth com os escopos requisitados
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');

// Cache do token em memória
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Inicializa o ouvinte de estado de autenticação
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Tenta checar se viemos de um redirecionamento bem-sucedido
        try {
          const result = await getRedirectResult(auth);
          if (result) {
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
              cachedAccessToken = credential.accessToken;
              if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
              return;
            }
          }
        } catch (error) {
          console.error("Erro no getRedirectResult do AuthChanged:", error);
        }

        // Se já está logado mas perdeu o token (ex: refresh de página),
        // precisaremos efetuar sign-in de novo para obter o token de acesso da API do Google,
        // já que o Firebase não o persiste no localStorage automaticamente para APIs de terceiros.
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Captura resultado pendente de redirecionamento na primeira carga
export const checkRedirectResult = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        return { user: result.user, accessToken: cachedAccessToken };
      }
    }
    return null;
  } catch (error) {
    console.error("Erro ao checar resultado de redirecionamento:", error);
    throw error;
  }
};

// Efetua login com o Google Popup (ideal para canais desktop)
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erro de login por Popup:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Efetua login com o Google Redirect (essencial para celulares para contornar qualquer bloqueio de popup)
export const googleSignInRedirect = async (): Promise<void> => {
  try {
    isSigningIn = true;
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Erro de login por Redirecionamento:', error);
    isSigningIn = false;
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
