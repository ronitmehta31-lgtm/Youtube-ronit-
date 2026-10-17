import { useLiveQuery } from 'dexie-react-hooks';
import { db, getFirm, getMeta, getPrefs } from './db';
import type { Books } from './reports';
import type { Prefs } from './types';

/** Live snapshot of the whole book. Re-renders when anything changes. */
export function useBooks(): (Books & { prefs: Prefs; lastBackupAt: string | null }) | undefined {
  return useLiveQuery(async () => {
    const [firm, prefs, parties, items, txns, accounts, categories, lastBackupAt] = await Promise.all([
      getFirm(), getPrefs(), db.parties.orderBy('name').toArray(), db.items.orderBy('name').toArray(),
      db.txns.toArray(), db.accounts.toArray(), db.categories.toArray(), getMeta<string | null>('lastBackupAt', null),
    ]);
    if (!firm) return { firm: null as any, prefs, parties, items, txns, accounts, categories, lastBackupAt };
    return { firm, prefs, parties, items, txns, accounts, categories, lastBackupAt };
  }, []);
}
