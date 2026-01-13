"use client";

import { supabase } from "./supabaseClient";

// Wrapper helpers that always return a predictable shape and catch runtime errors
export async function signUp(email: string, password: string) {
  try {
    if (!supabase) return { data: null, error: new Error("Supabase not configured") } as any;
    const res = await supabase.auth.signUp({ email, password });
    return res as any;
  } catch (err) {
    return { data: null, error: err as any } as any;
  }
}

export async function signIn(email: string, password: string) {
  try {
    if (!supabase) return { data: null, error: new Error("Supabase not configured") } as any;
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res as any;
  } catch (err) {
    return { data: null, error: err as any } as any;
  }
}

export async function signOut() {
  try {
    if (!supabase) return { data: null, error: new Error("Supabase not configured") } as any;
    const res = await supabase.auth.signOut();
    return res as any;
  } catch (err) {
    return { data: null, error: err as any } as any;
  }
}

export async function getSession() {
  try {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

export function onAuthStateChange(callback: (event: any, session: any) => void) {
  if (!supabase) return { data: null, subscription: { unsubscribe: () => {} } } as any;
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}
