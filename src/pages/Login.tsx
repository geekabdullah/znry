import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { Leaf, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signin') {
        const { error: err } = await signIn(email, password);
        if (err) throw new Error(err);
      } else {
        const { error: err } = await signUp(email, password, fullName);
        if (err) throw new Error(err);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(
        msg.includes('Invalid credentials') || msg.includes('invalid')
          ? 'Email or password is incorrect.'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-field-700 p-10 text-sand-50 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15), transparent 45%)',
          }}
        />
        <div className="relative">
          <Logo className="[&_*]:!text-sand-50" />
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-3xl font-semibold leading-tight">
            One workspace for every office on the farm.
          </h1>
          <p className="mt-4 text-sm text-sand-200">
            From the field assistant to the Managing Director, every request, approval, and release
            moves through one clear chain.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Crop, livestock, and technical services in one flow',
              'Approvals routed up the chain automatically',
              'Daily, weekly, and monthly reports at every office',
            ].map((line) => (
              <div key={line} className="flex items-start gap-3 text-sm">
                <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-sand-200" />
                <span className="text-sand-100">{line}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-sand-300">Zinariya Farms Limited · Operations console</p>
      </div>

      <div className="flex items-center justify-center bg-sand-50 px-5 py-12 pb-24 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink-900">
            {mode === 'signin' ? 'Welcome back' : 'Create your workspace'}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {mode === 'signin'
              ? 'Sign in to continue to your office dashboard.'
              : 'Set up the first admin account for Zinariya Farms.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === 'signup' && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Full name
                </span>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Finance Admin"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-field-500 focus:ring-2 focus:ring-field-200"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                Email
              </span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@zinariya.com"
                  className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none transition focus:border-field-500 focus:ring-2 focus:ring-field-200"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
                Password
              </span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none transition focus:border-field-500 focus:ring-2 focus:ring-field-200"
                />
              </div>
            </label>

            {error && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-field-600 py-2.5 text-sm font-semibold text-sand-50 transition hover:bg-field-700 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create workspace'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            {mode === 'signin' ? 'First time setting up?' : 'Already have an account?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="font-semibold text-field-700 hover:underline"
            >
              {mode === 'signin' ? 'Create the admin account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
