import { useSecureAuth } from '../../context/SecureAuthContext';

export default function AdminProfilePage() {
  const { user } = useSecureAuth();

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 12 }}>Admin Profile</h1>
      <p style={{ fontSize: '1rem', color: '#0f172a' }}>
        Email: <span style={{ fontWeight: 600 }}>{user?.email ?? 'Unknown'}</span>
      </p>
    </div>
  );
}
