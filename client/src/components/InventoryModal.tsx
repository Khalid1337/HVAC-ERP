import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface InventoryItem {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit_cost: number;
  reorder_level?: number;
}

interface InventoryModalProps {
  itemToEdit?: InventoryItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ itemToEdit, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [reorderLevel, setReorderLevel] = useState<number>(5);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name || '');
      setDescription(itemToEdit.description || '');
      setQuantity(itemToEdit.quantity || 0);
      setUnitCost(itemToEdit.unit_cost || 0);
      setReorderLevel(itemToEdit.reorder_level || 5);
    }
  }, [itemToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name,
      description,
      quantity: Number(quantity),
      unit_cost: Number(unitCost),
      reorder_level: Number(reorderLevel)
    };

    try {
      if (itemToEdit?.id) {
        await axios.put(`/api/inventory/${itemToEdit.id}`, payload);
      } else {
        await axios.post('/api/inventory', payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>{itemToEdit ? 'Edit Stock Item' : 'Add New Part to Inventory'}</h3>
          <button className="btn-secondary" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Item Name *</label>
            <input className="modern-input" type="text" required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Description</label>
            <input className="modern-input" type="text" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quantity</label>
              <input className="modern-input" type="number" min="0" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unit Cost (Rs.)</label>
              <input className="modern-input" type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Inventory Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
