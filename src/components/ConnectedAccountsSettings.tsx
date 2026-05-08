import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Trash2, RefreshCw, Building2, CreditCard, Loader2 } from 'lucide-react';
import { listConnections, deleteConnection, type BankConnection } from '../services/bankImportService';
import AddBankAccountModal from './AddBankAccountModal';

const PROVIDER_LABELS: Record<string, string> = {
  discount: 'Discount Bank',
  hapoalim: 'Bank Hapoalim',
  leumi: 'Bank Leumi',
  mizrahi: 'Mizrahi-Tefahot',
  beinleumi: 'First International',
  union: 'Union Bank',
  massad: 'Bank Massad',
  mercantile: 'Mercantile Bank',
  visaCal: 'Visa Cal',
  isracard: 'Isracard',
  amex: 'Amex Israel',
  max: 'Max (Leumi Card)',
};

const BANK_PROVIDERS = ['discount', 'hapoalim', 'leumi', 'mizrahi', 'beinleumi', 'union', 'massad', 'mercantile'];

function formatDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ConnectedAccountsSettings() {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const conns = await listConnections();
      setConnections(conns);
    } catch {
      // scraper offline or no connections
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this account connection? You can re-add it later.')) return;
    setDeletingId(id);
    try {
      await deleteConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Failed to delete connection — is the scraper service running?');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Connected Accounts</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Banks and credit cards to include when importing transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadConnections}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Account
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
          <CreditCard className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No accounts connected yet</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add your first account
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {connections.map((conn) => {
            const isBank = BANK_PROVIDERS.includes(conn.provider);
            return (
              <li
                key={conn.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="flex-shrink-0">
                  {isBank
                    ? <Building2 className="w-5 h-5 text-blue-500" />
                    : <CreditCard className="w-5 h-5 text-purple-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {conn.display_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {PROVIDER_LABELS[conn.provider] ?? conn.provider} · Last sync: {formatDate(conn.last_sync_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(conn.id)}
                  disabled={deletingId === conn.id}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  title="Remove connection"
                >
                  {deletingId === conn.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />
                  }
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showAddModal && (
        <AddBankAccountModal
          onClose={() => setShowAddModal(false)}
          onAdded={loadConnections}
        />
      )}
    </div>
  );
}
