import { useState } from 'react';
import { Lock, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';

export function PasswordReset() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await updatePassword(password);
    setLoading(false);
    if (updateError) {
      setError('We could not update your password. Please request a new recovery link.');
      return;
    }
    setSaved(true);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-sand-50 px-5 py-12">
      <div className="w-full max-w-md">
        <Logo className="mb-8" />
        <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-ink-900">Set a new password</h1>
          {saved ? (
            <div className="mt-4 rounded-lg bg-field-50 px-3 py-2 text-sm text-field-800 ring-1 ring-field-200">
              Your password has been updated. You can continue to the workspace.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">New password</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">Confirm password</span>
                <input required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-field-500 focus:ring-2 focus:ring-field-200" />
              </label>
              {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>}
              <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-field-600 py-2.5 text-sm font-semibold text-sand-50 hover:bg-field-700 disabled:opacity-70">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Update password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
