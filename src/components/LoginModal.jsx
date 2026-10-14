import { useState } from 'react';
import { KeyRound, Mail, Lock } from 'lucide-react';
import { Modal, Button } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginModal({ open, onClose }) {
  const { signIn, mode } = useAuth();
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const res = mode === 'supabase' ? await signIn({ email, password }) : await signIn({ pin });
    setLoading(false);
    if (res.ok) { setPin(''); setPassword(''); onClose(); } else setError(res.error || 'No se pudo iniciar sesión.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Acceso de administrador" width="max-w-sm">
      <form onSubmit={submit} className="space-y-3">
        {mode === 'supabase' ? (
          <>
            <label className="block text-sm">
              <span className="text-muted text-xs">Correo</span>
              <div className="relative mt-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-sunken border border-line rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" placeholder="admin@recycorp.pe" />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-muted text-xs">Contraseña</span>
              <div className="relative mt-1">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-sunken border border-line rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" placeholder="••••••••" />
              </div>
            </label>
          </>
        ) : (
          <label className="block text-sm">
            <span className="text-muted text-xs">PIN de administrador</span>
            <div className="relative mt-1">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="password" required autoFocus value={pin} onChange={(e) => setPin(e.target.value)} className="w-full bg-sunken border border-line rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" placeholder="PIN" />
            </div>
          </label>
        )}
        {error && <p className="text-xs text-bad">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>Ingresar</Button>
        <p className="text-[11px] text-muted text-center">
          {mode === 'supabase' ? 'Acceso restringido a cuentas administradoras.' : 'PIN de demostración definido en VITE_DEMO_ADMIN_PIN.'}
        </p>
      </form>
    </Modal>
  );
}
