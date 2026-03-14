import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, BellRing, BookOpen, CheckCircle2, ClipboardList, Lock, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import LoadingButton from '../components/LoadingButton';
import { useToast } from '../context/ToastContext';
import { getInvite, acceptInvite, type InvitePreview, type AssignmentPreviewItem } from '../dal/invites';
import { setActiveOrgPreference } from '../lib/secureStorage';

const ACCEPTABLE_STATUSES = new Set(['pending', 'sent']);

type PasswordStrength = {
  label: string;
  tone: string;
  percent: number;
};

const computePasswordStrength = (value: string, minLength: number): PasswordStrength => {
  if (!value) {
    return { label: 'Weak', tone: 'bg-gray-300', percent: 0 };
  }
  let score = 0;
  if (value.length >= minLength) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  const percent = Math.min(100, Math.round((score / 4) * 100));
  if (percent >= 75) return { label: 'Strong', tone: 'bg-emerald-500', percent };
  if (percent >= 50) return { label: 'Fair', tone: 'bg-amber-500', percent };
  if (percent >= 25) return { label: 'Needs work', tone: 'bg-orange-500', percent };
  return { label: 'Weak', tone: 'bg-rose-500', percent };
};

const formatDueCopy = (value?: string | null) => {
  if (!value) return 'Flexible schedule';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return 'Flexible schedule';
  try {
    return `Due ${new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  } catch {
    return 'Flexible schedule';
  }
};

const openMailComposer = (email: string, orgName?: string | null, inviteEmail?: string) => {
  const subject = encodeURIComponent(`New invite request for ${orgName || 'workspace'}`);
  const body = encodeURIComponent(
    `Hi,\n\nCould you send a fresh invite for ${inviteEmail || 'my account'}?\n\nThank you!`,
  );
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
};

const storeOnboardingSuccess = (payload: {
  orgId: string | null;
  orgName: string | null;
  email: string;
  assignments: { courses: number; surveys: number };
}) => {
  if (typeof window === 'undefined') return;
  try {
    const snapshot = {
      ...payload,
      recordedAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem('onboarding_welcome_payload', JSON.stringify(snapshot));
  } catch {
    // non-blocking
  }
};

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
  const passwordStrength = useMemo(
    () => computePasswordStrength(password, passwordMinLength),
    [password, passwordMinLength],
  );
  const contactEmail = invite?.contactEmail || invite?.inviterEmail || null;
  const organizationName = invite?.orgName || null;
  const inviteEmail = invite?.email || null;
  const coursePreview = invite?.assignmentPreview?.courses ?? [];
  const surveyPreview = invite?.assignmentPreview?.surveys ?? [];
  const hasAssignmentPreview = coursePreview.length > 0 || surveyPreview.length > 0;

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

  useEffect(() => {
    if (invite?.invitedName) {
      setFullName((prev) => prev || invite.invitedName || '');
    }
  }, [invite?.invitedName]);

  const handleRequestNewInvite = useCallback(() => {
    if (!contactEmail) {
      showToast('No contact email on file.', 'error');
      return;
    }
    openMailComposer(contactEmail, organizationName, inviteEmail ?? undefined);
  }, [contactEmail, organizationName, inviteEmail, showToast]);

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
      if (response.data.orgId) {
        try {
          setActiveOrgPreference(response.data.orgId);
        } catch {
          // ignore storage issues
        }
      }
      storeOnboardingSuccess({
        orgId: response.data.orgId ?? null,
        orgName: response.data.orgName ?? null,
        email: response.data.email,
        assignments: {
          courses: coursePreview.length,
          surveys: surveyPreview.length,
        },
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
          {contactEmail && (
            <button
              type="button"
              onClick={handleRequestNewInvite}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm hover:bg-white"
            >
              <BellRing className="h-3.5 w-3.5" />
              Request new invite
            </button>
          )}
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

        {hasAssignmentPreview && (
          <div className="card-lg border border-gray-100 bg-white shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-gray-800">
              <BookOpen className="h-5 w-5 text-orange-500" />
              <p className="font-semibold">What’s waiting for you</p>
            </div>
            <p className="text-sm text-gray-600">
              Your organization already assigned a few experiences so you can jump in right away.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {coursePreview.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <BookOpen className="h-4 w-4 text-gray-500" />
                    Courses
                  </p>
                  <ul className="space-y-2">
                    {coursePreview.slice(0, 3).map((course: AssignmentPreviewItem) => (
                      <li key={course.id} className="rounded-xl border border-gray-100 px-3 py-2">
                        <p className="font-semibold text-gray-900">{course.title || 'Course assignment'}</p>
                        <p className="text-xs text-gray-500">{formatDueCopy(course.dueAt)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {surveyPreview.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <ClipboardList className="h-4 w-4 text-gray-500" />
                    Surveys
                  </p>
                  <ul className="space-y-2">
                    {surveyPreview.slice(0, 3).map((survey: AssignmentPreviewItem) => (
                      <li key={survey.id} className="rounded-xl border border-gray-100 px-3 py-2">
                        <p className="font-semibold text-gray-900">{survey.title || 'Survey assignment'}</p>
                        <p className="text-xs text-gray-500">{formatDueCopy(survey.dueAt)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {acceptedPayload && (
          <div className="card-lg border border-emerald-100 bg-white shadow-lg space-y-4">
            <div className="flex items-center gap-3 text-emerald-700 mb-3">
              <ShieldCheck className="h-5 w-5" />
              <p className="font-semibold">You’re all set!</p>
            </div>
            <p className="text-gray-700 mb-4">
              {acceptedPayload.orgName ? `Welcome to ${acceptedPayload.orgName}.` : 'Your account is ready.'} You can sign in with
              <span className="font-semibold"> {acceptedPayload.email} </span>
              anytime.
            </p>
            {hasAssignmentPreview && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-sm text-emerald-900 space-y-2">
                <p className="font-semibold">Here’s what’s ready for you:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {coursePreview.length > 0 && <li>{coursePreview.length} course{coursePreview.length > 1 ? 's' : ''} assigned immediately.</li>}
                  {surveyPreview.length > 0 && <li>{surveyPreview.length} survey{surveyPreview.length > 1 ? 's' : ''} awaiting your perspective.</li>}
                  <li>Resources and announcements will appear on your dashboard after sign in.</li>
                </ul>
              </div>
            )}
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
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Password strength: {passwordStrength.label}</span>
                  <span>{passwordStrength.percent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.tone}`}
                    style={{ width: `${passwordStrength.percent}%` }}
                  />
                </div>
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
