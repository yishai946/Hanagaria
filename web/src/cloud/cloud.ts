// Accounts + saved projects on Supabase (free tier). Everything here is optional: without the two VITE_ keys the app stays local-only.
import { useEffect, useState } from 'react';
import type { SupabaseClient, Subscription, User } from '@supabase/supabase-js';
import type { RawPlan } from '@shared/types';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const cloudEnabled = !!(URL && KEY);

export interface Project { id: string; plan: RawPlan; createdAt: number }
interface ProjectRow { id: string; plan: RawPlan; created_at: string }

let clientP: Promise<SupabaseClient> | undefined;
const client = () => (clientP ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL!, KEY!)));
const here = () => location.origin + location.pathname;

export function useAuth() {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({ user: null, loading: cloudEnabled });
  useEffect(() => {
    if (!cloudEnabled) return;
    let dead = false;
    let sub: Subscription | undefined;
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
export type Auth = ReturnType<typeof useAuth>;

export async function signInGoogle() {
  const { error } = await (await client()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } });
  if (error) throw error;
}
export async function signInEmail(email: string) {
  const { error } = await (await client()).auth.signInWithOtp({ email, options: { emailRedirectTo: here() } });
  if (error) throw error;
}
export const signOut = async () => (await client()).auth.signOut();

const toProject = (r: ProjectRow): Project => ({ id: r.id, plan: r.plan, createdAt: Date.parse(r.created_at) });

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await (await client()).from('projects').select('id,plan,created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ProjectRow[]).map(toProject);
}
export async function addProject(plan: RawPlan): Promise<Project> {
  const { data, error } = await (await client()).from('projects').insert({ plan }).select('id,plan,created_at').single();
  if (error) throw error;
  return toProject(data as ProjectRow);
}
export async function deleteProject(id: string) {
  const { error } = await (await client()).from('projects').delete().eq('id', id);
  if (error) throw error;
}
