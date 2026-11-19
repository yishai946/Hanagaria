// Accounts + saved projects on Supabase (free tier). Everything here is optional: without the two VITE_ keys the app stays local-only.
import { useEffect, useState } from 'react';

const URL = import.meta.env.VITE_SUPABASE_URL, KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloudEnabled = !!(URL && KEY);

let clientP;
const client = () => (clientP ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL, KEY)));
const here = () => location.origin + location.pathname;

export function useAuth() {
  const [state, setState] = useState({ user: null, loading: cloudEnabled });
  useEffect(() => {
    if (!cloudEnabled) return;
    let dead = false, sub;
    client().then(async (c) => {
      const { data } = await c.auth.getSession();
      if (dead) return;
      setState({ user: data.session?.user ?? null, loading: false });
      sub = c.auth.onAuthStateChange((_e, s) => setState({ user: s?.user ?? null, loading: false })).data.subscription;
    }).catch(() => !dead && setState({ user: null, loading: false }));
    return () => { dead = true; sub?.unsubscribe(); };
  }, []);
  return state;
}

export async function signInGoogle() {
  const { error } = await (await client()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } });
  if (error) throw error;
}
export async function signInEmail(email) {
  const { error } = await (await client()).auth.signInWithOtp({ email, options: { emailRedirectTo: here() } });
  if (error) throw error;
}
export const signOut = async () => (await client()).auth.signOut();

const toProject = (r) => ({ id: r.id, plan: r.plan, createdAt: Date.parse(r.created_at) });

export async function listProjects() {
  const { data, error } = await (await client()).from('projects').select('id,plan,created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toProject);
}
export async function addProject(plan) {
  const { data, error } = await (await client()).from('projects').insert({ plan }).select('id,plan,created_at').single();
  if (error) throw error;
  return toProject(data);
}
export async function deleteProject(id) {
  const { error } = await (await client()).from('projects').delete().eq('id', id);
  if (error) throw error;
}
