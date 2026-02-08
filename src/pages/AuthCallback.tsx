import { useEffect, useState } from 'react';

const resolveLoginPath = () => {
  if (typeof window === 'undefined' || !window.location) {
    return '/lms/login';
  }
  const pathname = window.location.pathname || '';
  return pathname.startsWith('/admin') ? '/admin/login' : '/lms/login';
};

const AuthCallback = () => {
  const [message, setMessage] = useState('Redirecting you to the login page…');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setMessage('Please log in again.');
    window.location.assign(resolveLoginPath());
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-mist bg-white p-6 text-center shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate">Please log in again</p>
        <p className="mt-2 text-sm text-slate/80">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
