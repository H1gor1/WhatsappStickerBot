import { useEffect, useState, FormEvent } from 'react';
import { getCommands, createCommand, updateCommand, deleteCommand } from '../api/client';

interface Command {
  id: string;
  trigger: string;
  matchType: string;
  responseText: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = { trigger: '', matchType: 'EXACT', responseText: '', isActive: true };
const RESERVED_WORDS = ['download', 'baixar'];

function isReservedTrigger(trigger: string): boolean {
  const t = trigger.trim().toLowerCase();
  return RESERVED_WORDS.some((w) => t === w || t.startsWith(w + ' '));
}

export default function Commands() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const data = await getCommands();
      setCommands(data);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  function handleEdit(cmd: Command) {
    setForm({ trigger: cmd.trigger, matchType: cmd.matchType, responseText: cmd.responseText, isActive: cmd.isActive });
    setEditingId(cmd.id);
  }

  function cancelEdit() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateCommand(editingId, form);
      } else {
        await createCommand(form);
      }
      cancelEdit();
      load();
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCommand(id);
    load();
  }

  async function handleToggle(cmd: Command) {
    await updateCommand(cmd.id, { ...cmd, isActive: !cmd.isActive });
    load();
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Comandos Personalizados</h2>

      <form onSubmit={handleSubmit} style={{
        background: '#1a1a1a', padding: 20, borderRadius: 8, marginBottom: 24,
        display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600,
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            placeholder="Trigger (ex: /ajuda)"
            value={form.trigger}
            onChange={(e) => setForm({ ...form, trigger: e.target.value })}
            style={{ flex: 2, minWidth: 180, borderColor: isReservedTrigger(form.trigger) ? '#ffa500' : '#333' }}
            required
          />
          <select
            value={form.matchType}
            onChange={(e) => setForm({ ...form, matchType: e.target.value })}
            style={{ flex: 1, minWidth: 140 }}
          >
            <option value="EXACT">Exato</option>
            <option value="STARTS_WITH">Começa com</option>
            <option value="CONTAINS">Contém</option>
          </select>
        </div>
        {isReservedTrigger(form.trigger) && (
          <div style={{ color: '#ffa500', fontSize: 12, marginTop: -4 }}>
            ⚠ "download" e "baixar" são comandos reservados para o modo download.
            Se usar esse trigger, ele terá prioridade sobre o download.
          </div>
        )}
        <textarea
          placeholder="Resposta do bot..."
          value={form.responseText}
          onChange={(e) => setForm({ ...form, responseText: e.target.value })}
          rows={3}
          required
        />
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" disabled={loading} style={{ background: '#25D366', color: '#000', fontWeight: 600 }}>
            {editingId ? 'Atualizar' : 'Criar comando'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={{ background: '#444', color: '#e0e0e0' }}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div style={{ background: '#1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}>Trigger</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}>Tipo</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}>Resposta</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}>Ativo</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12 }}></th>
            </tr>
          </thead>
          <tbody>
            {commands.map((cmd) => (
              <tr key={cmd.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace' }}>{cmd.trigger}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#888' }}>{cmd.matchType}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cmd.responseText}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => handleToggle(cmd)}
                    style={{
                      background: cmd.isActive ? '#25D36620' : '#ff444420',
                      color: cmd.isActive ? '#25D366' : '#ff4444',
                      padding: '4px 10px', fontSize: 12, borderRadius: 4,
                    }}
                  >
                    {cmd.isActive ? 'Sim' : 'Não'}
                  </button>
                </td>
                <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                  <button onClick={() => handleEdit(cmd)} style={{ background: '#444', color: '#fff', padding: '4px 10px', fontSize: 12 }}>
                    Editar
                  </button>
                  <button onClick={() => handleDelete(cmd.id)} style={{ background: 'transparent', color: '#ff4444', padding: '4px 10px', fontSize: 12 }}>
                    Apagar
                  </button>
                </td>
              </tr>
            ))}
            {commands.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#666' }}>
                  Nenhum comando cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
