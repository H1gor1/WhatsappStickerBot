import { useEffect, useState } from 'react';
import { getHistory } from '../api/client';

interface StickerRequest {
  id: string;
  contact: { jid: string; name?: string };
  mediaType: string;
  source: string;
  requestType: string;
  status: string;
  sourceUrl?: string;
  errorMessage?: string;
  createdAt: string;
  processedAt?: string;
}

export default function History() {
  const [items, setItems] = useState<StickerRequest[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  async function load(p: number) {
    try {
      const params: Record<string, string> = { page: String(p), limit: '20' };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.requestType = typeFilter;
      const data = await getHistory(params);
      setItems(data.items);
      setTotalPages(data.pages);
      setTotal(data.total);
      setPage(p);
    } catch {}
  }

  useEffect(() => {
    load(1);
  }, []);

  function applyFilters() {
    load(1);
  }

  const sourceLabels: Record<string, string> = {
  DIRECT_UPLOAD: '📤 Upload',
  TWEET_LINK: '🐦 Twitter',
  TWITTER: '🐦 Twitter',
  INSTAGRAM: '📷 Instagram',
  TIKTOK: '🎵 TikTok',
  YOUTUBE: '▶️ YouTube',
  FACEBOOK: '📘 Facebook',
  REDDIT: '🤖 Reddit',
};

const sourceIcons: Record<string, string> = {
  DIRECT_UPLOAD: 'devicon-google-plain colored',
  TWEET_LINK: 'devicon-twitter-original',
  TWITTER: 'devicon-twitter-original',
  INSTAGRAM: 'devicon-instagram-plain colored',
  TIKTOK: 'devicon-tiktok-plain colored',
  YOUTUBE: 'devicon-youtube-plain colored',
  FACEBOOK: 'devicon-facebook-plain colored',
  REDDIT: 'devicon-reddit-plain colored',
};

function sourceIcon(source: string): string | null {
  return sourceIcons[source] || null;
}

function sourceLabel(source: string): string {
  return sourceLabels[source] || source;
}

const statusColors: Record<string, string> = {
    DONE: '#25D366',
    FAILED: '#ff4444',
    PROCESSING: '#ffa500',
    PENDING: '#888',
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Histórico ({total} registros)</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ flex: 1, minWidth: 140, maxWidth: 180 }}
        >
          <option value="">Todos status</option>
          <option value="DONE">Concluído</option>
          <option value="FAILED">Falhou</option>
          <option value="PENDING">Pendente</option>
          <option value="PROCESSING">Processando</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ flex: 1, minWidth: 140, maxWidth: 180 }}
        >
          <option value="">Todos tipos</option>
          <option value="STICKER">Figurinha</option>
          <option value="DOWNLOAD">Download</option>
        </select>
        <button onClick={applyFilters} style={{ background: '#25D366', color: '#000', fontWeight: 600 }}>
          Filtrar
        </button>
      </div>

      <div style={{ background: '#1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}>Contato</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}>Tipo</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}>Origem</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>
                  {item.contact.name || item.contact.jid.split('@')[0]}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12 }}>
                  <span style={{
                    background: '#333', padding: '2px 8px', borderRadius: 4,
                    color: '#aaa',
                  }}>
                    {item.mediaType} {item.requestType === 'DOWNLOAD' ? '⬇' : '📎'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#888' }}>
                  {sourceIcon(item.source) ? (
                    <i className={sourceIcon(item.source)!} style={{ fontSize: 16 }}></i>
                  ) : (
                    sourceLabel(item.source)
                  )}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12 }}>
                  <span style={{ color: statusColors[item.status] || '#888', fontWeight: 500 }}>
                    {item.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#888' }}>
                  {new Date(item.createdAt).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#666' }}>
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <button
            disabled={page <= 1}
            onClick={() => load(page - 1)}
            style={{ background: '#333', color: '#e0e0e0' }}
          >
            Anterior
          </button>
          <span style={{ padding: '10px 16px', color: '#888', fontSize: 13 }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => load(page + 1)}
            style={{ background: '#333', color: '#e0e0e0' }}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
