/*
  useAuthContext.ts — Hook for consuming authentication session context.
*/

import { useContext } from 'react';
import { AuthContext } from './authContextDef';

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
