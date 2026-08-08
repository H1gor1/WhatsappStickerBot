import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { switchNumber, disconnect, logout } from '../api/client';

type ConnStatus = 'connected' | 'awaiting_qr' | 'disconnected';

const navItems = [
  { path: '/admin', label: 'Dashboard' },
  { path: '/admin/history', label: 'Histórico' },
  { path: '/admin/metrics', label: 'Métricas' },
  { path: '/admin/commands', label: 'Comandos' },
  { path: '/admin/logs', label: 'Logs' },
  { path: '/admin/bans', label: 'Bans' },
  { path: '/admin/settings', label: 'Config' },
];

export default function Dashboard({ children }: { children?: React.ReactNode }) {
  const [status, setStatus] = useState<ConnStatus>('disconnected');
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const es = new EventSource('/admin/api/events');

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) setStatus(data.status);
        if (data.number !== undefined) setNumber(data.number);
        if (data.qr !== undefined) setQrImage(data.qr);
      } catch {}
    };

    return () => es.close();
  }, []);

  async function handleSwitchNumber() {
    setLoading(true);
    try {
      await switchNumber();
      setQrImage(null);
    } catch {} finally { setLoading(false); }
  }

  async function handleDisconnect() {
    setLoading(true);
    try { await disconnect(); } catch {} finally { setLoading(false); }
  }

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  const statusColor =
    status === 'connected' ? '#25D366' :
    status === 'awaiting_qr' ? '#ffa500' : '#ff4444';

  const statusText =
    status === 'connected' ? 'Conectado' :
    status === 'awaiting_qr' ? 'Aguardando QR' : 'Desconectado';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        width: 200, background: '#111', padding: 20,
        display: 'flex', flexDirection: 'column', gap: 4,
        borderRight: '1px solid #222',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#25D366' }}>BotFig</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: statusColor, boxShadow: `0 0 6px ${statusColor}`,
            }} />
            <span style={{ fontSize: 11, color: '#888' }}>{statusText}</span>
          </div>
        </div>

        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: location.pathname === item.path ? '#222' : 'transparent',
              color: location.pathname === item.path ? '#fff' : '#888',
              textAlign: 'left', padding: '10px 12px', fontSize: 13,
              borderRadius: 6, fontWeight: location.pathname === item.path ? 500 : 400,
            }}
          >
            {item.label}
          </button>
        ))}

        <div style={{ marginTop: 'auto' }}>
          <button onClick={handleLogout} style={{
            background: 'transparent', color: '#666', textAlign: 'left',
            padding: '10px 12px', fontSize: 13, width: '100%',
          }}>
            Sair
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}>
        {children ? (
          children
        ) : (
          <div>
            <h2 style={{ marginBottom: 24 }}>Dashboard</h2>

            <div style={{
              background: '#1a1a1a', borderRadius: 12, padding: 24, marginBottom: 24,
              border: `2px solid ${statusColor}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: statusColor, boxShadow: `0 0 8px ${statusColor}`,
                }} />
                <span style={{ fontSize: 16, fontWeight: 500 }}>{statusText}</span>
                {number && (
                  <span style={{ fontSize: 14, color: '#888', fontFamily: 'monospace' }}>
                    +{number}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleSwitchNumber}
                  disabled={loading}
                  style={{ background: '#25D366', color: '#000', fontWeight: 600 }}
                >
                  Gerar novo QR Code
                </button>
                {status === 'connected' && (
                  <button
                    onClick={handleDisconnect}
                    disabled={loading}
                    style={{ background: '#444', color: '#e0e0e0' }}
                  >
                    Desconectar
                  </button>
                )}
              </div>
            </div>

            {status === 'awaiting_qr' && qrImage && (
              <div style={{ textAlign: 'center', background: '#1a1a1a', borderRadius: 12, padding: 24 }}>
                <p style={{ marginBottom: 16, color: '#aaa' }}>Escaneie o QR code com o WhatsApp</p>
                <img src={qrImage} alt="QR Code" style={{ maxWidth: 280, borderRadius: 8 }} />
              </div>
            )}

            {status === 'awaiting_qr' && !qrImage && (
              <div style={{ textAlign: 'center', color: '#aaa', padding: 24 }}>
                Gerando QR code...
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
