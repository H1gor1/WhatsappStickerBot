import { useEffect, useState, FormEvent } from 'react';
import { getSettings, updateSettings } from '../api/client';

export default function Settings() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('Bot em manutenção. Volte mais tarde. 🔧');
  const [packName, setPackName] = useState('');
  const [packAuthor, setPackAuthor] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await getSettings();
      setMaintenanceMode(data.maintenance_mode === 'true');
      setMaintenanceMsg(data.maintenance_message || 'Bot em manutenção. Volte mais tarde. 🔧');
      setPackName(data.sticker_pack_name || '');
      setPackAuthor(data.sticker_pack_author || '');
    } catch {}
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await updateSettings({
        maintenance_mode: maintenanceMode ? 'true' : 'false',
        maintenance_message: maintenanceMsg,
        sticker_pack_name: packName,
        sticker_pack_author: packAuthor,
      });
      setMessage('Configurações salvas!');
    } catch {
      setMessage('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Configurações</h2>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
        <div style={{ background: '#1a1a1a', padding: 20, borderRadius: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: '#ffa500' }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Modo Manutenção</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                Quando ativo, o bot responde com uma mensagem fixa e não processa figurinhas
              </div>
            </div>
          </label>
        </div>

        <div>
          <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>
            Mensagem de manutenção
          </label>
          <textarea
            value={maintenanceMsg}
            onChange={(e) => setMaintenanceMsg(e.target.value)}
            rows={2}
            placeholder="Mensagem enviada quando o bot está em manutenção"
          />
        </div>

        <div style={{ borderTop: '1px solid #222', paddingTop: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, color: '#888' }}>Metadados do Pack de Figurinhas</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>
                Nome do Pack
              </label>
              <input
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="Ex: BotFig Stickers"
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>
                Autor
              </label>
              <input
                value={packAuthor}
                onChange={(e) => setPackAuthor(e.target.value)}
                placeholder="Ex: @seunome"
              />
            </div>
          </div>
        </div>

        <div>
          <button type="submit" disabled={saving} style={{ background: '#25D366', color: '#000', fontWeight: 600 }}>
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
          {message && <span style={{ marginLeft: 12, color: '#25D366', fontSize: 13 }}>{message}</span>}
        </div>
      </form>
    </div>
  );
}
