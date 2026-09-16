import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit_cost: number;
}

interface LineItem {
  type: 'part' | 'service';
  item_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceCreatorProps {
  onClose: () => void;
  onInvoiceCreated: () => void | Promise<void>;
}

export const InvoiceCreator: React.FC<InvoiceCreatorProps> = ({ onClose, onInvoiceCreated }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [warrantyTerms, setWarrantyTerms] = useState<string>('30 Days Repair & Replacement Warranty on original parts.');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [cRes, iRes] = await Promise.all([
          axios.get<Customer[]>('/api/customers'),
          axios.get<InventoryItem[]>('/api/inventory')
        ]);
        setCustomers(cRes.data);
        setInventory(iRes.data);
      } catch (err) {
        console.error('Failed to fetch modal dropdowns:', err);
      }
    };
    fetchDropdownData();
  }, []);

  const handleAddPartLine = (partId: string) => {
    const part = inventory.find(i => i.id === partId);
    if (!part) return;

    const retailUnitPrice = part.unit_cost * 1.5;

    setLineItems([...lineItems, {
      type: 'part',
      item_id: part.id,
      description: part.name,
      quantity: 1,
      unit_price: retailUnitPrice
    }]);
  };

  const handleAddServiceLine = () => {
    setLineItems([...lineItems, {
      type: 'service',
      description: 'HVAC Servicing / Installation Labor',
      quantity: 1,
      unit_price: 1500
    }]);
  };

  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleRemoveLine = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateGrandTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Please select a customer profile.');
      return;
    }
    if (lineItems.length === 0) {
      alert('Please add at least one line item to the invoice.');
      return;
    }

    try {
      const response = await axios.post('/api/invoices', {
        customer_id: selectedCustomerId,
        warranty_terms: warrantyTerms,
        items: lineItems
      });

      if (response.status >= 200 && response.status < 300) {
        await onInvoiceCreated();
        onClose();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Transaction Failed: Out of Stock or Invalid Data.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '900px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Create New Commercial Invoice</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Stock deduction occurs inside atomic SQL transactions upon creation.
            </p>
          </div>
          <button className="btn-secondary" onClick={onClose}>✕ Close</button>
        </div>

        <form onSubmit={handleSubmitInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Select Client Profile</label>
            <select 
              className="modern-input" 
              value={selectedCustomerId} 
              onChange={e => setSelectedCustomerId(e.target.value)}
              required
            >
              <option value="">-- Choose Register Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select className="modern-input" onChange={e => { if(e.target.value) { handleAddPartLine(e.target.value); e.target.value = ''; } }}>
              <option value="">+ Add Spare Part (Auto 50% Markup applied)</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id} disabled={item.quantity <= 0}>
                  {item.name} (Stock: {item.quantity}) - Cost: Rs. {item.unit_cost}
                </option>
              ))}
            </select>

            <button type="button" className="btn-secondary" onClick={handleAddServiceLine} style={{ whiteSpace: 'nowrap' }}>
              + Add Labor / Service
            </button>
          </div>

          <table className="modern-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Item / Service Description</th>
                <th style={{ width: '100px' }}>Qty</th>
                <th style={{ width: '140px' }}>Unit Price (Rs.)</th>
                <th style={{ width: '140px' }}>Subtotal</th>
                <th style={{ width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textTransform: 'capitalize', fontWeight: 600, color: item.type === 'part' ? 'var(--accent-cyan)' : 'var(--accent-green)' }}>
                    {item.type}
                  </td>
                  <td>
                    <input 
                      className="modern-input" 
                      type="text" 
                      value={item.description} 
                      onChange={e => handleItemChange(idx, 'description', e.target.value)} 
                    />
                  </td>
                  <td>
                    <input 
                      className="modern-input" 
                      type="number" 
                      min="1" 
                      value={item.quantity} 
                      onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)} 
                    />
                  </td>
                  <td>
                    <input 
                      className="modern-input" 
                      type="number" 
                      min="0" 
                      value={item.unit_price} 
                      onChange={e => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)} 
                    />
                  </td>
                  <td className="mono-text" style={{ fontWeight: 600 }}>
                    Rs. {(item.quantity * item.unit_price).toLocaleString()}
                  </td>
                  <td>
                    <button type="button" onClick={() => handleRemoveLine(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '1.1rem' }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Warranty Terms & Conditions</label>
              <textarea 
                className="modern-input" 
                rows={2} 
                value={warrantyTerms} 
                onChange={e => setWarrantyTerms(e.target.value)} 
              />
            </div>
            
            <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grand Total</span>
              <div className="mono-text" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                Rs. {calculateGrandTotal().toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Finalize & Process Invoice</button>
          </div>

        </form>

      </div>
    </div>
  );
};
