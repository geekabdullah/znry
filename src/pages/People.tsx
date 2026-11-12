import { useMemo, useState } from 'react';
import { UserPlus, Search, Users, Mail, Building2, Loader2, Upload, X, Trash2, KeyRound, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { deleteManagedUser, resetManagedUserPassword } from '@/lib/adminUsers';
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
  const [resetting, setResetting] = useState<Profile | null>(null);

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
                    onResetPassword={() => setResetting(p)}
                    onDelete={async () => {
                      if (!confirm(`Delete ${p.full_name}'s account? This cannot be undone.`)) return;
                      try {
                        await deleteManagedUser(p.id);
                        reload();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Could not delete the account.');
                      }
                    }}
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
      {resetting && (
        <ResetPasswordModal
          person={resetting}
          onClose={() => setResetting(null)}
          onDone={() => setResetting(null)}
        />
      )}
    </div>
  );
}

function PersonCard({
  person,
  canManage,
  onEdit,
  onResetPassword,
  onDelete,
}: {
  person: Profile;
  canManage: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
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
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={onEdit}
            className="rounded-lg border border-ink-200 py-2.5 text-xs font-semibold text-ink-700 transition hover:bg-sand-50"
          >
            Edit
          </button>
          <button
            onClick={onResetPassword}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-ink-200 py-2.5 text-xs font-semibold text-ink-700 transition hover:bg-sand-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Password
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </Card>
  );
}

function ResetPasswordModal({
  person,
  onClose,
  onDone,
}: {
  person: Profile;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('The new password must be at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await resetManagedUserPassword(person.id, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.');
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(`${person.email} / ${password}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleClose() {
    setPassword('');
    setConfirmation('');
    setError(null);
    setSuccess(false);
    setShowPwd(false);
    onClose();
  }

  return (
    <div className="modal-scroll fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={handleClose} aria-hidden />
      <div className="relative my-auto w-full max-w-md animate-fade-in rounded-2xl bg-sand-50 shadow-card">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-ink-100 bg-sand-50 px-5 py-4">
          <div className="min-w-0 pr-2">
            <h2 className="font-display text-base font-semibold text-ink-900">Reset password</h2>
            <p className="truncate text-xs text-ink-500">
              {person.full_name} · {person.email}
            </p>
          </div>
          <button onClick={handleClose} className="shrink-0 rounded-lg p-2 text-ink-500 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="space-y-4 px-5 py-6">
            <div className="rounded-lg bg-field-50 px-4 py-3 text-sm text-field-800 ring-1 ring-field-200">
              The password has been updated. Share the new login details below with {person.full_name}.
            </div>
            <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Login details</p>
              <p className="mt-1.5 text-sm text-ink-800">
                <span className="text-ink-500">Email: </span>
                <span className="font-medium">{person.email}</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-800">
                <span className="text-ink-500">Password: </span>
                <span className="font-medium">{password}</span>
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-sand-50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-field-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy details'}
              </button>
            </div>
            <button onClick={onDone} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-field-700 px-4 py-2.5 text-sm font-semibold text-sand-50 transition hover:bg-field-800">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
            <p className="text-xs text-ink-500">
              Set a new password for this account. The user will use this along with their email
              ({person.email}) to sign in. You can share it with them directly.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                New password
              </span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  required
                  minLength={8}
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-10 text-sm text-ink-900 outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                Confirm password
              </span>
              <input
                required
                minLength={8}
                type={showPwd ? 'text' : 'password'}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="Re-enter the password"
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200"
              />
            </label>
            {error && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                {error}
              </div>
            )}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-ink-100">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-field-700 px-4 py-2.5 text-sm font-semibold text-sand-50 transition hover:bg-field-800 disabled:opacity-70">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Reset password
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
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
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200" />
          </Field>
          <Field label="Job title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Department">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as Profile['department'])}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200"
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
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200"
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
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-ink-100">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-field-700 px-4 py-2.5 text-sm font-semibold text-sand-50 transition hover:bg-field-800 disabled:opacity-70">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </button>
          </div>
        </form>
      </div>
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
