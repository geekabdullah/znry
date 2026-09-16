import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Activity, ActivityUpdate, Profile, RequestType, Worker } from './types';

export function useActivities(filters?: {
  department?: string;
  status?: string;
  search?: string;
  chainStage?: string;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('activities')
      .select('*, requester:profiles!requester_id(*)')
      .order('created_at', { ascending: false });

    if (filters?.department && filters.department !== 'all') {
      query = query.eq('department', filters.department);
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.chainStage && filters.chainStage !== 'all') {
      query = query.eq('chain_stage', filters.chainStage);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
      setActivities([]);
    } else {
      setActivities((data as Activity[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [filters?.department, filters?.status, filters?.chainStage, filters?.search]);

  useEffect(() => {
    load();
  }, [load]);

  return { activities, loading, error, reload: load };
}

export function usePendingActions() {
  const [pending, setPending] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activities')
      .select('*, requester:profiles!requester_id(*)')
      .in('chain_stage', ['supervisor', 'manager', 'md', 'disbursement'])
      .order('created_at', { ascending: false });
    setPending((data as Activity[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { pending, loading, reload: load };
}

export function useActivityUpdates(activityId: string | null) {
  const [updates, setUpdates] = useState<ActivityUpdate[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activityId) {
      setUpdates([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('activity_updates')
      .select('*, author:profiles!author_id(*)')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });
    setUpdates((data as ActivityUpdate[]) ?? []);
    setLoading(false);
  }, [activityId]);

  useEffect(() => {
    load();
  }, [load]);

  return { updates, loading, reload: load };
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { profiles, loading, reload: load };
}

export function useSupervisors() {
  const [supervisors, setSupervisors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'supervisor')
      .eq('active', true)
      .order('full_name', { ascending: true });
    if (err) {
      setSupervisors([]);
      setError(err.message);
    } else {
      setSupervisors((data as Profile[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { supervisors, loading, error, reload: load };
}

export async function createActivity(params: {
  title: string;
  description: string;
  department: string;
  category: string;
  priority: string;
  amount: number | null;
  due_date: string | null;
  request_type: RequestType;
  supervisor_id: string | null;
}): Promise<Activity> {
  const { data, error } = await supabase.rpc('create_activity', {
    p_title: params.title,
    p_description: params.description,
    p_department: params.department,
    p_category: params.category,
    p_priority: params.priority,
    p_amount: params.amount,
    p_due_date: params.due_date,
    p_request_type: params.request_type,
    p_supervisor_id: params.supervisor_id,
  });
  if (error) throw error;
  // Fetch the full activity with requester relation
  const { data: full, error: fetchErr } = await supabase
    .from('activities')
    .select('*, requester:profiles!requester_id(*)')
    .eq('id', (data as Activity).id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  return full as Activity;
}

export async function advanceActivity(
  activityId: string,
  decision: 'reviewed' | 'approved' | 'declined' | 'returned' | 'completed',
  note: string,
  disbursement?: {
    payment_ref?: string;
    amount_released?: number;
    stock_item?: string;
    stock_qty?: number;
  },
): Promise<Activity> {
  const { data, error } = await supabase.rpc('advance_activity', {
    p_activity_id: activityId,
    p_decision: decision,
    p_note: note,
    p_payment_ref: disbursement?.payment_ref ?? null,
    p_amount_released: disbursement?.amount_released ?? null,
    p_stock_item: disbursement?.stock_item ?? null,
    p_stock_qty: disbursement?.stock_qty ?? null,
  });
  if (error) throw error;
  // Fetch full activity with requester
  const { data: full, error: fetchErr } = await supabase
    .from('activities')
    .select('*, requester:profiles!requester_id(*)')
    .eq('id', (data as Activity).id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  return full as Activity;
}

export function useWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('workers')
      .select('*')
      .order('created_at', { ascending: false });
    setWorkers((data as Worker[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { workers, loading, reload: load };
}
