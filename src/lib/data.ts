import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Activity, ActivityAttachment, ActivityUpdate, PendingUpload, Profile, RequestType, Worker } from './types';

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

const ATTACHMENTS_BUCKET = 'request-attachments';
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'application/zip': 'zip',
};

export const ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.zip';

function fileExt(file: File): string {
  const fromMime = EXT_BY_MIME[file.type];
  if (fromMime) return fromMime;
  const dot = file.name.lastIndexOf('.');
  return dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'bin';
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name} is larger than 10 MB. Please choose a smaller file.`;
  }
  return null;
}

async function uploadOneAttachment(activityId: string, file: File): Promise<void> {
  const path = `${activityId}/${crypto.randomUUID()}.${fileExt(file)}`;
  const { error: upErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (upErr) throw upErr;
  const { error: rowErr } = await supabase.from('activity_attachments').insert({
    activity_id: activityId,
    file_name: file.name,
    file_path: path,
    file_size: file.size,
    file_type: file.type || '',
  });
  if (rowErr) {
    const { error: cleanupErr } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
    if (cleanupErr) console.error('attachment cleanup failed:', cleanupErr);
    throw rowErr;
  }
}

export async function uploadActivityAttachments(
  activityId: string,
  pending: PendingUpload[],
): Promise<PendingUpload[]> {
  const failed: PendingUpload[] = [];
  for (const item of pending) {
    try {
      await uploadOneAttachment(activityId, item.file);
    } catch (err) {
      console.error('attachment upload failed:', item.file.name, err);
      failed.push(item);
    }
  }
  return failed;
}

export function useActivityAttachments(activityId: string | null) {
  const [attachments, setAttachments] = useState<ActivityAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activityId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('activity_attachments')
      .select('*, uploader:profiles!uploaded_by(*)')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });
    setAttachments((data as ActivityAttachment[]) ?? []);
    setLoading(false);
  }, [activityId]);

  useEffect(() => {
    load();
  }, [load]);

  return { attachments, loading, reload: load };
}

export async function getAttachmentSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(filePath, 300);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not generate file link.');
  return data.signedUrl;
}

export async function deleteAttachment(attachment: ActivityAttachment): Promise<void> {
  const { error: storageErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .remove([attachment.file_path]);
  if (storageErr) throw storageErr;
  const { error: rowErr } = await supabase
    .from('activity_attachments')
    .delete()
    .eq('id', attachment.id);
  if (rowErr) throw rowErr;
}
