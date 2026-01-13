"use client";

import { supabase } from "./supabaseClient";

export async function signUp(email: string, password: string) {
  if (!supabase) return { error: new Error("Supabase not configured") } as any;
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  if (!supabase) return { error: new Error("Supabase not configured") } as any;
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return { error: new Error("Supabase not configured") } as any;
  return supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (event: any, session: any) => void) {
  if (!supabase) return { data: null, subscription: { unsubscribe: () => {} } } as any;
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}
