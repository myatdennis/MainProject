import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Lock, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import LoadingButton from '../components/LoadingButton';
import { useToast } from '../context/ToastContext';
import { getInvite, acceptInvite, type InvitePreview } from '../dal/invites';

const ACCEPTABLE_STATUSES = new Set(['pending', 'sent']);

const InviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const { showToast } = useToast();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<boolean>(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPayload, setAcceptedPayload] = useState<{ orgName: string | null; loginUrl: string; email: string } | null>(null);

  const passwordMinLength = useMemo(() => invite?.passwordPolicy?.minLength || 8, [invite]);

  const actionable = useMemo(() => {
    if (!invite) return false;
    return ACCEPTABLE_STATUSES.has(invite.status);
  }, [invite]);

  const fetchInvite = useCallback(async () => {
    if (!token) {
      setError('Invite token missing');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
  const response = await getInvite(token);
      setInvite(response.data);
    } catch (err: any) {
      const message = err?.message || 'Unable to load invite';
      setError(message);
      setInvite(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  const handleAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !invite) return;

    if (password.length < passwordMinLength) {
      showToast(`Password must be at least ${passwordMinLength} characters.`, 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setAccepting(true);
    setError(null);
    try {
  const response = await acceptInvite(token, {
        fullName,
        password,
      });
      setAcceptedPayload({
        orgName: response.data.orgName,
        loginUrl: response.data.loginUrl,
        email: response.data.email,
      });
      showToast('Invitation accepted. You can sign in now.', 'success');
      setInvite((prev) => (prev ? { ...prev, status: 'accepted', acceptedAt: new Date().toISOString() } : prev));
    } catch (err: any) {
      const message = err?.message || 'Unable to accept invite';
      setError(message);
      showToast(message, 'error');
    } finally {
      setAccepting(false);
    }
  };

  const statusBanner = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center gap-3 text-gray-600">
          <div className="w-10 h-10 border-4 border-orange-300 border-t-transparent rounded-full animate-spin" />
          <p>Checking invitation…</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">{error}</p>
            <p className="text-sm">Double-check the invitation link or request a new one from the admin team.</p>
          </div>
          <LoadingButton onClick={fetchInvite} variant="secondary" className="ml-auto">
            <RefreshCw className="h-4 w-4" />
            Retry
          </LoadingButton>
        </div>
      );
    }

    if (invite?.status === 'accepted') {
      return (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            <p className="font-semibold">Invite already accepted</p>
            <p className="text-sm">Use the sign-in link below to access the workspace.</p>
          </div>
        </div>
      );
    }

    if (invite?.status === 'expired' || invite?.status === 'revoked') {
      return (
        <div className="bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-semibold">This invite is no longer valid.</p>
            <p className="text-sm">Ask your workspace admin to send a new invitation.</p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 via-white to-white min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-orange-500 uppercase tracking-widest">Workspace Invitation</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {invite?.orgName ? `Join ${invite.orgName}` : 'Accept your invitation'}
          </h1>
          <p className="text-gray-600">
            Securely activate your access and step into your organization’s workspace.
          </p>
        </div>

        {statusBanner()}

        {acceptedPayload && (
          <div className="card-lg border border-emerald-100 bg-white shadow-lg">
            <div className="flex items-center gap-3 text-emerald-700 mb-3">
              <ShieldCheck className="h-5 w-5" />
              <p className="font-semibold">You’re all set!</p>
            </div>
            <p className="text-gray-700 mb-4">
              {acceptedPayload.orgName ? `Welcome to ${acceptedPayload.orgName}.` : 'Your account is ready.'} You can sign in with
              <span className="font-semibold"> {acceptedPayload.email} </span>
              anytime.
            </p>
            <a
              href={acceptedPayload.loginUrl}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition"
            >
              Go to login
            </a>
          </div>
        )}

        {!loading && actionable && !acceptedPayload && invite && (
          <form onSubmit={handleAccept} className="card-lg bg-white shadow-xl border border-gray-100 space-y-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-700">Invitation details</p>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Mail className="h-4 w-4" />
                <span>{invite.email}</span>
              </div>
              <p className="text-xs text-gray-500">
                Role: <span className="font-semibold">{invite.role}</span> · Expires {new Date(invite.expiresAt).toLocaleString()}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Create password</label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    minLength={passwordMinLength}
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum {passwordMinLength} characters.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <LoadingButton type="submit" loading={accepting} variant="primary" disabled={accepting} className="w-full justify-center">
              Activate workspace access
            </LoadingButton>

            <p className="text-xs text-gray-500 text-center">
              By continuing you agree to the workspace terms of use and acknowledge the invitation email on file ({invite.email}).
            </p>
          </form>
        )}

        {!loading && !invite && !error && (
          <div className="text-center text-gray-600">
            <p>Invite details unavailable. Please contact your administrator.</p>
          </div>
        )}

        <div className="text-center text-sm text-gray-500">
          Need help? <Link to="/contact" className="text-orange-600 font-semibold">Contact support</Link>
        </div>
      </div>
    </div>
  );
};

export default InviteAccept;
