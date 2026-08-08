import { useEffect, useState } from 'react';
import { getMetrics, getDailyMetrics } from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const sourceLabels: Record<string, string> = {
  DIRECT_UPLOAD: 'Upload',
  TWEET_LINK: 'Twitter',
  TWITTER: 'Twitter',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  REDDIT: 'Reddit',
};

const sourceColors: Record<string, string> = {
  DIRECT_UPLOAD: '#25D366',
  TWEET_LINK: '#1DA1F2',
  TWITTER: '#1DA1F2',
  INSTAGRAM: '#E4405F',
  TIKTOK: '#69C9D0',
  YOUTUBE: '#FF0000',
  FACEBOOK: '#1877F2',
  REDDIT: '#FF4500',
};

export default function Metrics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [m, d] = await Promise.all([getMetrics(), getDailyMetrics()]);
      setMetrics(m);
      setDaily(d);
    } catch {}
  }

  if (!metrics) return <div style={{ color: '#888', padding: 24 }}>Carregando...</div>;

  const pieData = [
    { name: 'Sucesso', value: metrics.done, color: '#25D366' },
    { name: 'Falhas', value: metrics.failed, color: '#ff4444' },
  ].filter(d => d.value > 0);

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Métricas</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total" value={metrics.total} color="#25D366" />
        <StatCard label="Últ. 7 dias" value={metrics.last7d} color="#888" />
        <StatCard label="Taxa de erro" value={`${metrics.errorRate}%`} color="#ff4444" />
        <StatCard label="Sucesso" value={metrics.done} color="#25D366" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, color: '#888' }}>Status dos Pedidos</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem dados</div>
          )}
        </div>

        <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, color: '#888' }}>Origem das Mídias</h3>
          {metrics.bySource && Object.keys(metrics.bySource).length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={Object.entries(metrics.bySource).map(([name, value]) => ({
                    name: sourceLabels[name] || name,
                    value,
                    color: sourceColors[name] || '#888',
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%" outerRadius={80}
                >
                  {Object.entries(metrics.bySource).map(([name], i) => (
                    <Cell key={i} fill={sourceColors[name] || '#888'} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem dados</div>
          )}
        </div>
      </div>

      <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 24 }}>
        <h3 style={{ marginBottom: 16, fontSize: 14, color: '#888' }}>Figurinhas por Dia (últ. 7 dias)</h3>
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6 }} />
              <Bar dataKey="done" name="Sucesso" fill="#25D366" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Falhas" fill="#ff4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem dados</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 20 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
