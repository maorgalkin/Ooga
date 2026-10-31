import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { listUnfinishedImports } from '../services/bankImportService';

export const unfinishedImportKeys = {
  mine: (userId: string | undefined) => ['unfinishedImports', userId] as const,
};

// The import window can be opened from several places; it announces finished, cancelled and
// postponed reviews so every list of unfinished imports catches up
const IMPORTS_CHANGED = 'ooga:imports-changed';

/** Tells the app an import's review was finished, cancelled or postponed. */
export function notifyImportsChanged() {
  window.dispatchEvent(new Event(IMPORTS_CHANGED));
}

/** The signed-in person's imports whose rows still wait for a decision ("Finish later"). */
export function useUnfinishedImports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = unfinishedImportKeys.mine(user?.id);

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
    window.addEventListener(IMPORTS_CHANGED, refresh);
    return () => window.removeEventListener(IMPORTS_CHANGED, refresh);
  }, [queryClient, key[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return useQuery({ queryKey: key, queryFn: listUnfinishedImports, enabled: !!user?.id });
}
