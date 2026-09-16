import { useMemo, useState } from 'react';
import { UserPlus, Search, Users, Mail, Building2, Loader2, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useProfiles } from '@/lib/data';
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { NewUserModal } from '@/components/NewUserModal';
import { ROLE_LABELS, ROLE_OPTIONS, roleLabel } from '@/lib/constants';
import type { Profile, Role } from '@/lib/types';

export function People() {
  const { profile: me } = useAuth();
  const { profiles, loading, reload } = useProfiles();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editing, setEditing] = useState<Profile | null>(null);

  const canManage = me?.role === 'admin' || me?.role === 'md';

  const filtered = useMemo(
    () =>
      profiles.filter((p) => {
        const matchesSearch =
          p.full_name.toLowerCase().includes(search.toLowerCase()) ||
          p.email.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === 'all' || p.role === roleFilter;
        return matchesSearch && matchesRole;
      }),
    [profiles, search, roleFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Profile[]>();
    filtered.forEach((p) => {
      const arr = map.get(p.department) ?? [];
      arr.push(p);
      map.set(p.department, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="People & Offices"
        subtitle="Every member of the Zinariya team and the office they hold."
        action={
          canManage ? (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-field-600 px-4 py-2 text-sm font-semibold text-sand-50 transition hover:bg-field-700"
            >
              <UserPlus className="h-4 w-4" />
              Add team member
            </button>
          ) : undefined
        }
      />

      <Card className="mb-5 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-field-500"
          >
            <option value="all">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {grouped.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No people yet"
          message="When you add team members they will appear here grouped by office."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([department, members]) => (
            <div key={department}>
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-field-700" />
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-700">
                  {department}
                </h2>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">
                  {members.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((p) => (
                  <PersonCard
                    key={p.id}
                    person={p}
                    canManage={canManage && p.id !== me?.id}
                    onEdit={() => setEditing(p)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewUserModal open={showNew} onClose={() => setShowNew(false)} onCreated={reload} />
      {editing && (
        <EditPersonModal
          person={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PersonCard({
  person,
  canManage,
  onEdit,
}: {
  person: Profile;
  canManage: boolean;
  onEdit: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar profile={person} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{person.full_name}</p>
          <p className="truncate text-xs text-ink-500">{person.title}</p>
          <span className="mt-1.5 inline-flex rounded-full bg-field-50 px-2 py-0.5 text-[11px] font-medium text-field-700">
            {roleLabel(person.role, person.department)}
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500">
        <div className="flex items-center gap-2 truncate">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          {person.email}
        </div>
      </div>
      {canManage && (
        <button
          onClick={onEdit}
          className="mt-3 w-full rounded-lg border border-ink-200 py-2.5 text-xs font-semibold text-ink-700 transition hover:bg-sand-50"
        >
          Edit profile
        </button>
      )}
    </Card>
  );
}

function EditPersonModal({
  person,
  onClose,
  onSaved,
}: {
  person: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(person.full_name);
  const [title, setTitle] = useState(person.title);
  const [department, setDepartment] = useState(person.department);
  const [role, setRole] = useState<Role>(person.role);
  const [avatarUrl, setAvatarUrl] = useState(person.avatar_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop();
      const path = `${person.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc('admin_update_profile', {
        p_profile_id: person.id,
        p_full_name: fullName,
        p_title: title,
        p_department: department,
        p_role: role,
        p_avatar_url: avatarUrl || null,
      });
      if (err) throw err;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-scroll fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative my-auto w-full max-w-md animate-fade-in rounded-2xl bg-sand-50 shadow-card">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-ink-100 bg-sand-50 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-ink-900">Edit profile</h2>
          <button onClick={onClose} className="shrink-0 rounded-lg p-2 text-ink-500 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-4">
            <Avatar
              profile={{ full_name: fullName, avatar_url: avatarUrl }}
              size="lg"
            />
            <label className="cursor-pointer rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-sand-50">
              <span className="inline-flex items-center gap-1.5">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload photo
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </label>
          </div>
          <Field label="Full name">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="edit-input" />
          </Field>
          <Field label="Job title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="edit-input" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Department">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as Profile['department'])}
                className="edit-input"
              >
                {(
                  [
                    'Crop Production',
                    'Livestock Production',
                    'Technical Services',
                    'Procurement',
                    'Marketing',
                    'Inspectorate',
                    'Training',
                    'Finance & Admin',
                    'Executive',
                  ] as const
                ).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="edit-input"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r, department)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="edit-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="edit-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </button>
          </div>
        </form>
      </div>
      <style>{editStyles}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const editStyles = `
  .edit-input {
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid #d9d6cc;
    background: #ffffff;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #1f1d1a;
  }
  .edit-input:focus {
    outline: none;
    border-color: #527e3e;
    box-shadow: 0 0 0 3px rgba(82,126,62,0.15);
  }
  .edit-primary {
    display: inline-flex; align-items: center; gap: 0.5rem;
    border-radius: 0.5rem; background: #3f6230; color: #f5f0e6;
    padding: 0.5rem 1rem; font-weight: 600; font-size: 0.875rem;
  }
  .edit-primary:hover { background: #324e27; }
  .edit-primary:disabled { opacity: .7; }
  .edit-ghost {
    border-radius: 0.5rem; padding: 0.5rem 1rem; font-weight: 500; font-size: 0.875rem; color: #4a463f;
  }
  .edit-ghost:hover { background: #eeece6; }
`;
