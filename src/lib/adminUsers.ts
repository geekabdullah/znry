import type { Profile } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface AdminUserResponse {
  profile?: Profile;
  ok?: boolean;
  error?: string;
}

async function callAdminUserManagement(body: Record<string, unknown>): Promise<AdminUserResponse> {
  const { data, error } = await supabase.functions.invoke('admin-user-management', { body });
  if (error) throw new Error('Could not complete the account request.');
  if (!data || typeof data !== 'object') throw new Error('Could not complete the account request.');
  const result = data as AdminUserResponse;
  if (result.error) throw new Error(result.error);
  return result;
}

export function createManagedUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: Profile['role'];
  department: Profile['department'];
  title: string;
}) {
  return callAdminUserManagement({ action: 'create', ...input });
}

export function deleteManagedUser(profileId: string) {
  return callAdminUserManagement({ action: 'delete', profileId });
}

export function resetManagedUserPassword(profileId: string, password: string) {
  return callAdminUserManagement({ action: 'resetPassword', profileId, password });
}
