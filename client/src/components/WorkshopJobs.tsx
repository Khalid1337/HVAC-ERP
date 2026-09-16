import React, { useState, useEffect } from 'react';

interface Job {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  item_description: string;
  serial_number: string;
  status: string;
  fault_reported: string;
  created_at: string;
}

interface JobLog {
  id: string;
  stage: string;
  notes: string;
  logged_at: string;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit_cost: number;
}

interface RepairCost {
  id: string;
  source: 'in_house' | 'outsourced';
  description: string;
  quantity: number;
  unit_cost: number;
  total_amount: number;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface WorkshopJobsProps {
  onDataChanged?: () => void | Promise<void>;
}

export const WorkshopJobs: React.FC<WorkshopJobsProps> = ({ onDataChanged }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedJobLogs, setSelectedJobLogs] = useState<JobLog[]>([]);
  const [selectedJobCosts, setSelectedJobCosts] = useState<RepairCost[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filter State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // New Job Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newJob, setNewJob] = useState({
    customer_id: '',
    item_description: '',
    serial_number: '',
    fault_reported: ''
  });

  // New Log Form State
  const [newStage, setNewStage] = useState('Diagnostics');
  const [newNotes, setNewNotes] = useState('');
  const [costSource, setCostSource] = useState<'in_house' | 'outsourced'>('in_house');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [costQuantity, setCostQuantity] = useState(1);
  const [outsourcedDescription, setOutsourcedDescription] = useState('');
  const [outsourcedAmount, setOutsourcedAmount] = useState(0);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      setInventory(data);
    } catch (err) {
      console.error('Failed to fetch inventory', err);
    }
  };

  const fetchLogs = async (jobId: string) => {
    try {
      const [logsRes, costsRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/logs`),
        fetch(`/api/jobs/${jobId}/costs`)
      ]);
      setSelectedJobLogs(await logsRes.json());
      setSelectedJobCosts(await costsRes.json());
      setActiveJobId(jobId);
    } catch (err) {
      console.error('Failed to fetch job logs', err);
    }
  };

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJobId) return;

    try {
      const res = await fetch(`/api/jobs/${activeJobId}/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: costSource,
          inventory_item_id: costSource === 'in_house' ? selectedInventoryId : undefined,
          description: costSource === 'outsourced' ? outsourcedDescription : undefined,
          quantity: costQuantity,
          amount: costSource === 'outsourced' ? outsourcedAmount : undefined
        })
      });

      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Failed to record repair cost.');
        return;
      }

      setSelectedInventoryId('');
      setCostQuantity(1);
      setOutsourcedDescription('');
      setOutsourcedAmount(0);
      await fetchLogs(activeJobId);
      await fetchInventory();
      await onDataChanged?.();
    } catch (err) {
      console.error('Failed to save repair cost', err);
      alert('Failed to record repair cost.');
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob)
      });

      if (res.ok) {
        setNewJob({ customer_id: '', item_description: '', serial_number: '', fault_reported: '' });
        setIsModalOpen(false);
        fetchJobs();
      } else {
        alert('Failed to register equipment job.');
      }
    } catch (err) {
      console.error('Error creating job:', err);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJobId || !newNotes) return;

    try {
      const res = await fetch(`/api/jobs/${activeJobId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage, notes: newNotes })
      });

      if (res.ok) {
        setNewNotes('');
        fetchLogs(activeJobId);
        fetchJobs();
      }
    } catch (err) {
      console.error('Failed to save repair log', err);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchCustomers();
    fetchInventory();
  }, []);

  const formatDate = (rawDate?: string) => {
    if (!rawDate) return 'N/A';
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? rawDate : d.toLocaleDateString();
  };

  const filteredJobs = jobs.filter(job => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'WIP') return job.status === 'WIP' || job.status === 'Diagnostics' || job.status === 'QC' || job.status === 'Ready';
    if (statusFilter === 'Handed Over') return job.status === 'Handed Over';
    return job.status === statusFilter;
  });

  const activeJobDetails = jobs.find(j => j.id === activeJobId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* HEADER BAR WITH FILTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Workshop Repair Center</h3>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="modern-input"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <option value="all">All Jobs ({jobs.length})</option>
              <option value="WIP">Work in Progress (Active)</option>
              <option value="Handed Over">Handed Over</option>
            </select>
          </div>

          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            + Register Equipment
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* ACTIVE EQUIPMENT TABLE */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h4 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)' }}>Active Equipment & Units</h4>
          <table className="modern-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Equipment / Item</th>
                <th>Client Details</th>
                <th>Serial # / Fault</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Loading workshop inventory...
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No workshop repair logs match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <tr key={job.id} style={{ backgroundColor: activeJobId === job.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{job.item_description}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Logged: {formatDate(job.created_at)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{job.customer_name}</div>
                      <div className="mono-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{job.customer_phone}</div>
                    </td>
                    <td>
                      <div className="mono-text" style={{ fontSize: '0.8rem' }}>SN: {job.serial_number || 'N/A'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fault: {job.fault_reported || 'None'}</div>
                    </td>
                    <td>
                      <span style={{ 
                        backgroundColor: job.status === 'Handed Over' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
                        color: job.status === 'Handed Over' ? '#10b981' : '#f59e0b', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600 
                      }}>
                        {job.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => fetchLogs(job.id)}
                      >
                        {activeJobId === job.id ? 'Viewing Timeline' : 'View Timeline'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* TIMELINE & REPAIR LOG UPDATE PANEL */}
        <div className="glass-card" style={{ padding: '24px', height: 'fit-content' }}>
          <h4 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)' }}>Repair Lifecycle Timeline</h4>
          {activeJobId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                Selected Unit: {activeJobDetails?.item_description}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                {selectedJobLogs.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No progress logs recorded yet for this unit.</p>
                ) : (
                  selectedJobLogs.map(log => (
                    <div key={log.id} style={{ borderLeft: '2px solid var(--accent-cyan)', paddingLeft: '10px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{log.stage}</span>
                      <p style={{ margin: '2px 0', color: 'var(--text-main)' }}>{log.notes}</p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(log.logged_at).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddLog} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}>Add Repair Update</h5>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Stage</label>
                  <select 
                    value={newStage} 
                    onChange={(e) => setNewStage(e.target.value)}
                    className="modern-input"
                    style={{ fontSize: '0.85rem', padding: '6px' }}
                  >
                    <option value="Diagnostics">Diagnostics</option>
                    <option value="WIP">Work in Progress (WIP)</option>
                    <option value="QC">Quality Control (QC)</option>
                    <option value="Ready">Ready for Handover</option>
                    <option value="Handed Over">Handed Over</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Action Notes</label>
                  <textarea 
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g., Replaced copper tubes & refilled gas"
                    className="modern-input"
                    rows={2}
                    style={{ fontSize: '0.85rem', padding: '6px' }}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: '8px', fontSize: '0.85rem', marginTop: '4px' }}>
                  Log Update
                </button>
              </form>

              <form onSubmit={handleAddCost} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}>Record Repair Cost</h5>
                <select className="modern-input" value={costSource} onChange={e => setCostSource(e.target.value as 'in_house' | 'outsourced')} style={{ fontSize: '0.85rem', padding: '6px' }}>
                  <option value="in_house">In-house inventory part</option>
                  <option value="outsourced">Outsourced part purchase</option>
                </select>

                {costSource === 'in_house' ? (
                  <>
                    <select className="modern-input" required value={selectedInventoryId} onChange={e => setSelectedInventoryId(e.target.value)} style={{ fontSize: '0.85rem', padding: '6px' }}>
                      <option value="">Select inventory part</option>
                      {inventory.map(item => (
                        <option key={item.id} value={item.id} disabled={item.quantity <= 0}>
                          {item.name} - Stock: {item.quantity} - Cost: Rs. {item.unit_cost.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <input className="modern-input" type="number" min="1" required value={costQuantity} onChange={e => setCostQuantity(parseInt(e.target.value, 10) || 1)} placeholder="Quantity" style={{ fontSize: '0.85rem', padding: '6px' }} />
                  </>
                ) : (
                  <>
                    <input className="modern-input" type="text" required value={outsourcedDescription} onChange={e => setOutsourcedDescription(e.target.value)} placeholder="Part purchased outside" style={{ fontSize: '0.85rem', padding: '6px' }} />
                    <input className="modern-input" type="number" min="0.01" step="0.01" required value={outsourcedAmount || ''} onChange={e => setOutsourcedAmount(parseFloat(e.target.value) || 0)} placeholder="Total purchase amount" style={{ fontSize: '0.85rem', padding: '6px' }} />
                    <input className="modern-input" type="number" min="1" required value={costQuantity} onChange={e => setCostQuantity(parseInt(e.target.value, 10) || 1)} placeholder="Quantity" style={{ fontSize: '0.85rem', padding: '6px' }} />
                  </>
                )}
                <button type="submit" className="btn-secondary" style={{ padding: '8px', fontSize: '0.85rem' }}>Save Repair Cost</button>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total recorded for this unit: <span className="mono-text">Rs. {selectedJobCosts.reduce((sum, cost) => sum + cost.total_amount, 0).toLocaleString()}</span>
                </div>
                {selectedJobCosts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                    {selectedJobCosts.map(cost => (
                      <div key={cost.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span>{cost.description} ({cost.source === 'in_house' ? 'In-house' : 'Outsourced'}) x{cost.quantity}</span>
                        <span className="mono-text">Rs. {cost.total_amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select "View Timeline" on any unit from the list to manage its lifecycle updates.</p>
          )}
        </div>
      </div>

      {/* REGISTER EQUIPMENT MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-main)' }}>Register Equipment for Repair</h3>
            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Select Client</label>
                <select 
                  className="modern-input" 
                  required 
                  value={newJob.customer_id} 
                  onChange={e => setNewJob({ ...newJob, customer_id: e.target.value })}
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Equipment / Item Description</label>
                <input 
                  className="modern-input" 
                  type="text" 
                  required 
                  placeholder="e.g., 1.5 Ton DC Inverter Indoor Unit" 
                  value={newJob.item_description} 
                  onChange={e => setNewJob({ ...newJob, item_description: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Serial Number</label>
                <input 
                  className="modern-input" 
                  type="text" 
                  placeholder="e.g., SN-998234-AX" 
                  value={newJob.serial_number} 
                  onChange={e => setNewJob({ ...newJob, serial_number: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Reported Fault / Issue</label>
                <textarea 
                  className="modern-input" 
                  rows={3} 
                  placeholder="e.g., Not cooling, error code E5 on display" 
                  value={newJob.fault_reported} 
                  onChange={e => setNewJob({ ...newJob, fault_reported: e.target.value })} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Job Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
