import { useState } from 'react';
import { Modal, Segmented } from '../ui.jsx';
import DataLoader from './DataLoader.jsx';
import SitesManager from './SitesManager.jsx';
import GoalsSettings from './GoalsSettings.jsx';

export default function AdminPanel({ open, onClose }) {
  const [tab, setTab] = useState('datos');
  return (
    <Modal open={open} onClose={onClose} title="Administración" width="max-w-3xl">
      <Segmented
        value={tab} onChange={setTab}
        options={[{ value: 'datos', label: 'Datos (CSV)' }, { value: 'sedes', label: 'Sedes' }, { value: 'metas', label: 'Metas y segmentos' }]}
        className="mb-4"
      />
      {tab === 'datos' && <DataLoader />}
      {tab === 'sedes' && <SitesManager />}
      {tab === 'metas' && <GoalsSettings />}
    </Modal>
  );
}
