import React, { useState, useEffect } from 'react';

interface ScrapItem {
  id: string;
  item_description: string;
  category: string;
  purchase_cost: number;
  status: 'In Stock' | 'Sold';
  sold_price?: number;
  acquired_date: string;
  sold_date?: string;
}

interface ScrapInventoryProps {
  onDataChanged?: () => void;
}

export const ScrapInventory: React.FC<ScrapInventoryProps> = ({ onDataChanged }) => {
  const [scrapItems, setScrapItems] = useState<ScrapItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sellModalItem, setSellModalItem] = useState<ScrapItem | null>(null);
  const [editingItem, setEditingItem] = useState<ScrapItem | null>(null);
  const [soldPriceInput, setSoldPriceInput] = useState<number>(0);

  const [newScrap, setNewScrap] = useState({
    item_description: '',
    category: 'AC',
    purchase_cost: 0
  });

  useEffect(() => {
    fetchScrap();
  }, []);

  const fetchScrap = async () => {
    try {
      const res = await fetch('/api/scrap');
      const data = await res.json();
      setScrapItems(data);
    } catch (err) {
      console.error('Failed to fetch scrap items', err);
    }
  };

  const handleAddScrap = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/scrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newScrap)
      });
      if (res.ok) {
        setNewScrap({ item_description: '', category: 'AC', purchase_cost: 0 });
        setIsModalOpen(false);
        await fetchScrap();
        onDataChanged?.();
      }
    } catch (err) {
      console.error('Failed to add scrap item', err);
    }
  };

  const handleSellScrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellModalItem) return;

    try {
      const res = await fetch(`/api/scrap/${sellModalItem.id}/sell`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold_price: soldPriceInput })
      });
      if (res.ok) {
        setSellModalItem(null);
        setSoldPriceInput(0);
        await fetchScrap();
        onDataChanged?.();
      }
    } catch (err) {
      console.error('Failed to mark scrap as sold', err);
    }
  };

  const handleEditScrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const res = await fetch(`/api/scrap/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_description: editingItem.item_description,
          category: editingItem.category,
          purchase_cost: editingItem.purchase_cost,
          sold_price: editingItem.sold_price
        })
      });
      if (res.ok) {
        setEditingItem(null);
        await fetchScrap();
        onDataChanged?.();
      }
    } catch (err) {
      console.error('Failed to edit scrap item', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Scrap Inventory (Broken Units)</h3>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          + Add Broken Unit
        </button>
      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        <table className="modern-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Item Description</th>
              <th>Category</th>
              <th>Purchase Cost (Deducted)</th>
              <th>Status</th>
              <th>Sold Price / Recovery</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scrapItems.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No scrap inventory found.
                </td>
              </tr>
            ) : (
              scrapItems.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.item_description}</td>
                  <td>{item.category}</td>
                  <td style={{ color: '#ef4444', fontWeight: 600 }}>-Rs. {item.purchase_cost}</td>
                  <td>
                    <span style={{ 
                      backgroundColor: item.status === 'Sold' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
                      color: item.status === 'Sold' ? '#10b981' : '#f59e0b', 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 
                    }}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ color: item.sold_price ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                    {item.sold_price ? `+Rs. ${item.sold_price}` : 'Pending'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: '8px' }}
                      onClick={() => setEditingItem({ ...item })}
                    >
                      Edit
                    </button>
                    {item.status === 'In Stock' && (
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => { setSellModalItem(item); setSoldPriceInput(0); }}
                      >
                        Sell Scrap
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ADD SCRAP MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-main)' }}>Register Broken Scrap Unit</h3>
            <form onSubmit={handleAddScrap} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Item Description</label>
                <input 
                  className="modern-input" 
                  type="text" 
                  required 
                  placeholder="e.g., Old Haier 1.5 Ton Broken AC" 
                  value={newScrap.item_description} 
                  onChange={e => setNewScrap({ ...newScrap, item_description: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Category</label>
                <select 
                  className="modern-input" 
                  value={newScrap.category} 
                  onChange={e => setNewScrap({ ...newScrap, category: e.target.value })}
                >
                  <option value="AC">Air Conditioner (AC)</option>
                  <option value="Fridge">Refrigerator</option>
                  <option value="Other">Other Equipment</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Purchase Cost (Rs.) - Deducts from Monthly Earnings</label>
                <input 
                  className="modern-input" 
                  type="number" 
                  min="0" 
                  required 
                  value={newScrap.purchase_cost} 
                  onChange={e => setNewScrap({ ...newScrap, purchase_cost: parseFloat(e.target.value) || 0 })} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Scrap Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SELL SCRAP MODAL */}
      {sellModalItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '28px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--text-main)' }}>Complete Scrap Sale</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Unit: <span style={{ color: 'var(--accent-cyan)' }}>{sellModalItem.item_description}</span>
            </p>
            <form onSubmit={handleSellScrap} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Selling / Recovery Price (Rs.) - Adds to Current Month</label>
                <input 
                  className="modern-input" 
                  type="number" 
                  min="0" 
                  required 
                  value={soldPriceInput} 
                  onChange={e => setSoldPriceInput(parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setSellModalItem(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Confirm Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-main)' }}>Edit Scrap Unit</h3>
            <form onSubmit={handleEditScrap} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Item Description</label>
                <input className="modern-input" type="text" required value={editingItem.item_description} onChange={e => setEditingItem({ ...editingItem, item_description: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Category</label>
                <select className="modern-input" value={editingItem.category} onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}>
                  <option value="AC">Air Conditioner (AC)</option>
                  <option value="Fridge">Refrigerator</option>
                  <option value="Other">Other Equipment</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Purchase Cost (Rs.)</label>
                <input className="modern-input" type="number" min="0" required value={editingItem.purchase_cost} onChange={e => setEditingItem({ ...editingItem, purchase_cost: parseFloat(e.target.value) || 0 })} />
              </div>
              {editingItem.status === 'Sold' && (
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Sold Price / Recovery (Rs.)</label>
                  <input className="modern-input" type="number" min="0" required value={editingItem.sold_price ?? 0} onChange={e => setEditingItem({ ...editingItem, sold_price: parseFloat(e.target.value) || 0 })} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
