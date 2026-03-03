import { type ReactNode } from 'react';
import RequireAuth from './RequireAuth';

interface ClientRequireAuthProps {
  children: ReactNode;
}

const ClientRequireAuth = ({ children }: ClientRequireAuthProps) => {
  return (
    <RequireAuth mode="lms" loginPathOverride="/login">
      {children}
    </RequireAuth>
  );
};

export default ClientRequireAuth;
