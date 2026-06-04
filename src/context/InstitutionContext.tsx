import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { InstitutionSettings } from '../types';
import { getInstitutionSettings } from '../services/supabase';

interface InstitutionContextValue {
  settings: InstitutionSettings | null;
  loading: boolean;
  setupComplete: boolean;
  refresh: () => Promise<void>;
}

const InstitutionContext = createContext<InstitutionContextValue>({
  settings: null,
  loading: true,
  setupComplete: false,
  refresh: async () => {},
});

export const InstitutionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<InstitutionSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInstitutionSettings();
      setSettings(data);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <InstitutionContext.Provider
      value={{
        settings,
        loading,
        setupComplete: !!settings?.setup_completed,
        refresh,
      }}
    >
      {children}
    </InstitutionContext.Provider>
  );
};

export const useInstitution = () => useContext(InstitutionContext);
