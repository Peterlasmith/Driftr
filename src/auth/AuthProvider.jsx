import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Persist sessions across refreshes (default in most cases, but explicit is clearer).
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // Ignore persistence errors (e.g. Safari private mode); Firebase will fall back.
    });

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(() => {
    return {
      user,
      initializing,
      signUpWithEmail: (email, password) =>
        createUserWithEmailAndPassword(auth, email, password),
      signInWithEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
      signInWithGoogle: () => signInWithPopup(auth, googleProvider),
      logout: () => signOut(auth)
    };
  }, [user, initializing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

