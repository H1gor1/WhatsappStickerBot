import { useEffect, useState } from 'react';

interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  context?: string;
  createdAt: string;
}

export default function Logs() {
  const [items, setItems] = useState<ErrorLog[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function load(p: number) {
    try {
      const res = await fetch(`/admin/api/logs?page=${p}&limit=50`, { credentials: 'include' });
      const data = await res.json();
      setItems(data.items);
      setTotalPages(data.pages);
      setPage(p);
    } catch {}
  }

  useEffect(() => { load(1); }, []);

  async function clearAll() {
    await fetch('/admin/api/logs', { method: 'DELETE', credentials: 'include' });
    load(1);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>Logs de Erro</h2>
        {items.length > 0 && (
          <button onClick={clearAll} style={{ background: '#ff444420', color: '#ff4444', padding: '8px 16px', fontSize: 12 }}>
            Limpar todos
          </button>
        )}
      </div>

      <div style={{ background: '#1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
        {items.map((item) => (
          <div key={item.id} style={{ borderBottom: '1px solid #222' }}>
            <div
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
            >
              <span style={{ color: '#ff4444', fontSize: 14 }}>✕</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, wordBreak: 'break-word' }}>{item.message}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                  {new Date(item.createdAt).toLocaleString('pt-BR')}
                  {item.context && <span style={{ marginLeft: 8, color: '#888' }}>{item.context}</span>}
                </div>
              </div>
            </div>
            {expanded === item.id && item.stack && (
              <pre style={{
                margin: 0, padding: '12px 16px 12px 44px', fontSize: 11,
                color: '#888', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                background: '#0a0a0a', maxHeight: 200, overflow: 'auto',
              }}>
                {item.stack}
              </pre>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Nenhum erro registrado</div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <button disabled={page <= 1} onClick={() => load(page - 1)} style={{ background: '#333', color: '#e0e0e0' }}>
            Anterior
          </button>
          <span style={{ padding: '10px 16px', color: '#888', fontSize: 13 }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => load(page + 1)} style={{ background: '#333', color: '#e0e0e0' }}>
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
