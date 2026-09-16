import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { roleLabel } from '@/lib/constants';
import { X, UserPlus, ShieldCheck, Loader2, Mail, Lock, User as UserIcon } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: Profile) => void;
}

export function NewUserModal({ open, onClose, onCreated }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Profile['role']>('staff');
  const [department, setDepartment] = useState<Profile['department']>('Crop Production');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('staff');
      setDepartment('Crop Production');
      setTitle('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_create_profile', {
        p_email: email,
        p_password: password,
        p_full_name: fullName,
        p_role: role,
        p_department: department,
        p_title: title || roleLabel(role, department),
      });
      if (rpcError) throw rpcError;
      if (data) onCreated?.(data as Profile);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create the user.';
      if (msg.includes('duplicate') || msg.includes('already') || msg.includes('exists')) {
        setError('That email is already registered.');
      } else if (msg.includes('Not authorized')) {
        setError('You do not have permission to create users. Only admins and the MD can do this.');
      } else if (msg.includes('MD account already exists')) {
        setError('An MD account already exists. Only one MD can be created.');
      } else if (msg.includes('Admin accounts cannot be created')) {
        setError('Admin accounts cannot be created through the app.');
      } else if (msg.includes('Password must be at least')) {
        setError('Password must be at least 6 characters.');
      } else if (msg.includes('Could not create auth user') || msg.includes('Could not create identity') || msg.includes('Could not create profile')) {
        console.error('admin_create_profile failed:', msg);
        setError('Could not create the user. Please check the details and try again.');
      } else {
        console.error('admin_create_profile failed:', msg);
        setError('Could not create the user. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-scroll fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative my-auto w-full max-w-lg animate-fade-in rounded-2xl bg-sand-50 shadow-card">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-ink-100 bg-sand-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-field-100 text-field-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-ink-900">Add a team member</h2>
              <p className="text-xs text-ink-500">Create login details and assign an office.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <Field label="Full name" icon={<UserIcon className="h-4 w-4" />}>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Aisha Bello"
              className="input"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" icon={<Mail className="h-4 w-4" />}>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aisha@zinariya.com"
                className="input"
              />
            </Field>
            <Field label="Temporary password" icon={<Lock className="h-4 w-4" />}>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Office / Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Profile['role'])}
                className="input"
              >
                {(['md', 'manager', 'supervisor', 'assistant', 'storekeeper', 'staff'] as const).map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r, department)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as Profile['department'])}
                className="input"
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
          </div>
          <Field label="Job title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Maize Team Supervisor"
              className="input"
            />
          </Field>

          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Create login
            </button>
          </div>
        </form>
      </div>
      <style>{inputStyles}</style>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyles = `
  .input {
    width: 100%;
    border-radius: 0.625rem;
    border: 1px solid #d9d6cc;
    background: #ffffff;
    padding: 0.55rem 0.75rem;
    font-size: 0.875rem;
    color: #1f1d1a;
    transition: border-color .15s, box-shadow .15s;
  }
  .input:focus {
    outline: none;
    border-color: #527e3e;
    box-shadow: 0 0 0 3px rgba(82,126,62,0.15);
  }
  .btn-primary {
    display: inline-flex; align-items: center; gap: 0.5rem;
    border-radius: 0.625rem;
    background: #3f6230; color: #f5f0e6;
    padding: 0.5rem 1rem; font-weight: 600; font-size: 0.875rem;
    transition: background .15s, transform .05s;
  }
  .btn-primary:hover { background: #324e27; }
  .btn-primary:active { transform: translateY(1px); }
  .btn-primary:disabled { opacity: .7; }
  .btn-ghost {
    border-radius: 0.625rem;
    padding: 0.5rem 1rem; font-weight: 500; font-size: 0.875rem;
    color: #4a463f;
  }
  .btn-ghost:hover { background: #eeece6; }
`;
