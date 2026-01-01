import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';

const AdminAuthTest = () => {
  const { login, isAuthenticated, user } = useAuth();
  const [status, setStatus] = useState('');

  const testLogin = async () => {
    setStatus('Attempting login...');
    try {
  const result = await login('mya@the-huddle.co', 'admin123', 'admin');
      setStatus(`Login result: ${JSON.stringify(result)}`);
    } catch (error) {
      setStatus(`Login error: ${error}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Admin Auth Test</h1>
      <div className="space-y-4">
        <div>
          <strong>Authentication Status:</strong>
          <pre>{JSON.stringify(isAuthenticated, null, 2)}</pre>
        </div>
        <div>
          <strong>User:</strong>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
        <div>
          <button 
            onClick={testLogin}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Admin Login
          </button>
        </div>
        <div>
          <strong>Status:</strong> {status}
        </div>
      </div>
    </div>
  );
};

export default AdminAuthTest;