import { useEffect, useState, FormEvent } from 'react';
import { getBans, createBan, deleteBan } from '../api/client';

interface Ban {
  id: string;
  jid: string;
  reason?: string;
  bannedAt: string;
}

export default function Bans() {
  const [bans, setBans] = useState<Ban[]>([]);
  const [jid, setJid] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await getBans();
      setBans(data);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createBan(jid, reason || undefined);
      setJid('');
      setReason('');
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteBan(id);
    load();
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Números Banidos</h2>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          placeholder="JID (ex: 5511999999999@s.whatsapp.net)"
          value={jid}
          onChange={(e) => setJid(e.target.value)}
          style={{ flex: 2, minWidth: 250 }}
          required
        />
        <input
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ flex: 1, minWidth: 150 }}
        />
        <button type="submit" disabled={loading} style={{ background: '#ff4444', color: '#fff' }}>
          Banir
        </button>
      </form>

      {error && <div style={{ color: '#ff4444', marginBottom: 16 }}>{error}</div>}

      <div style={{ background: '#1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888' }}>JID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888' }}>Motivo</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888' }}>Data</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888' }}></th>
            </tr>
          </thead>
          <tbody>
            {bans.map((ban) => (
              <tr key={ban.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{ban.jid}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#aaa' }}>{ban.reason || '-'}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>
                  {new Date(ban.bannedAt).toLocaleDateString('pt-BR')}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => handleDelete(ban.id)}
                    style={{ background: 'transparent', color: '#ff4444', padding: '4px 8px', fontSize: 12 }}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {bans.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#666' }}>
                  Nenhum número banido
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
