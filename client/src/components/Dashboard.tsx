import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { DEFAULT_BRANDING, CompanyBranding } from '../config/branding';
import { WorkshopJobs } from './WorkshopJobs';
import { ScrapInventory } from './ScrapInventory';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  created_at?: string;
}

interface CustomerBusinessInvoice {
  id: string;
  date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  services: string;
}

interface CustomerBusinessHistory {
  invoices: CustomerBusinessInvoice[];
  total_billed: number;
  total_collected: number;
}

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit_cost: number;
  reorder_level: number;
  purchase_date?: string;
}

interface Invoice {
  id: string;
  customer_id: string;
  customer_name?: string;
  date?: string;
  created_at?: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  warranty_terms: string;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  type: string;
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface SelectedInvoiceDetails {
  invoice: Invoice;
  customer?: Customer;
  items: InvoiceItem[];
}

interface FinancialSummary {
  revenue: number;
  expenses: number;
  netEarnings: number;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  notes: string;
}

type TabType = 'inventory' | 'customers' | 'invoices' | 'workshop' | 'scrap';

interface DashboardProps {
  onOpenInvoiceCreator: () => void;
  defaultTab?: TabType;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onOpenInvoiceCreator, 
  defaultTab = 'inventory' 
}) => {
  const [branding, setBranding] = useState<CompanyBranding>(() => {
    const saved = localStorage.getItem('hvac_branding');
    return saved ? JSON.parse(saved) : DEFAULT_BRANDING;
  });

  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // Financial Summary State
  const [thisMonthSummary, setThisMonthSummary] = useState<FinancialSummary>({ revenue: 0, expenses: 0, netEarnings: 0 });
  const [lifetimeSummary, setLifetimeSummary] = useState<FinancialSummary>({ revenue: 0, expenses: 0, netEarnings: 0 });
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Selected Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<SelectedInvoiceDetails | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [customerBusiness, setCustomerBusiness] = useState<Record<string, CustomerBusinessHistory>>({});
  const [loadingCustomerBusinessId, setLoadingCustomerBusinessId] = useState<string | null>(null);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState<boolean>(false);

  // Editing States
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingInventory, setEditingInventory] = useState<InventoryItem | null>(null);

  // Form States
  const [newPart, setNewPart] = useState({ name: '', description: '', quantity: 0, unit_cost: 0, reorder_level: 5, purchase_date: new Date().toISOString().slice(0, 10) });
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', email: '' });
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    notes: ''
  });

  // Month Filter State for Invoices & Dashboard Metrics
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [reportMonth, setReportMonth] = useState<string>(currentYearMonth);
  const [isExporting, setIsExporting] = useState(false);

  // Keep activeTab in sync when defaultTab prop changes
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setFetchError(null);
      const [invRes, custRes, invcRes, expensesRes, monthSumRes, lifeSumRes] = await Promise.all([
        axios.get<InventoryItem[]>('/api/inventory'),
        axios.get<Customer[]>('/api/customers'),
        axios.get<Invoice[]>('/api/invoices'),
        axios.get<Expense[]>('/api/expenses'),
        axios.get<FinancialSummary>(`/api/expenses/summary/monthly?month=${currentYearMonth}`),
        axios.get<FinancialSummary>('/api/expenses/summary/lifetime')
      ]);
      setInventory(invRes.data || []);
      setCustomers(custRes.data || []);
      setInvoices(invcRes.data || []);
      setExpenses(expensesRes.data || []);
      setThisMonthSummary(monthSumRes.data || { revenue: 0, expenses: 0, netEarnings: 0 });
      setLifetimeSummary(lifeSumRes.data || { revenue: 0, expenses: 0, netEarnings: 0 });
    } catch (err) {
      console.error('Failed to fetch ERP records:', err);
      setFetchError('Unable to load dashboard data. Check that the backend service is running.');
    }
  };

  const refreshCustomerBusiness = async (customerId: string) => {
    try {
      setLoadingCustomerBusinessId(customerId);
      const response = await axios.get<CustomerBusinessHistory>(`/api/customers/${customerId}/business`);
      setCustomerBusiness(previous => ({ ...previous, [customerId]: response.data }));
    } finally {
      setLoadingCustomerBusinessId(null);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string, requestedPaidAmount?: number) => {
    try {
      const response = await axios.patch(`/api/invoices/${invoiceId}/status`, { 
        status: newStatus,
        payment_status: newStatus,
        paid_amount: requestedPaidAmount
      });

      if (response.status >= 200 && response.status < 300) {
        const updatedPaidAmount = response.data.paid_amount;
        if (selectedInvoice && selectedInvoice.invoice.id === invoiceId) {
          setSelectedInvoice({
            ...selectedInvoice,
            invoice: { ...selectedInvoice.invoice, status: newStatus, paid_amount: updatedPaidAmount }
          });
          setPaymentAmount(updatedPaidAmount);
        }
        await fetchData();
        const changedInvoice = invoices.find(invoice => invoice.id === invoiceId);
        if (changedInvoice && expandedCustomerId === changedInvoice.customer_id) {
          await refreshCustomerBusiness(changedInvoice.customer_id);
        }
      }
    } catch (err: any) {
      console.error('Error updating status:', err?.response?.data || err.message);
      alert(`Failed to update invoice payment status: ${err?.response?.data?.message || err.message}`);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoiceId}? Stock will be restored to inventory.`)) {
      return;
    }

    try {
      const response = await axios.delete(`/api/invoices/${invoiceId}`);
      if (response.status >= 200 && response.status < 300) {
        alert('Invoice deleted successfully!');
        if (selectedInvoice && selectedInvoice.invoice.id === invoiceId) {
          setSelectedInvoice(null);
        }
        fetchData();
      }
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err.message;
      alert(`Failed to delete invoice: ${errorMessage}`);
    }
  };

  // CUSTOMER EDIT & DELETE HANDLERS
  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    if (!window.confirm(`Are you sure you want to delete customer "${customerName}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/customers/${customerId}`);
      alert('Customer deleted successfully!');
      fetchData();
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err.message;
      alert(`Failed to delete customer: ${errorMessage}`);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    try {
      await axios.put(`/api/customers/${editingCustomer.id}`, editingCustomer);
      alert('Customer details updated successfully!');
      setEditingCustomer(null);
      fetchData();
    } catch (err: any) {
      console.error('Error updating customer:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err.message;
      alert(`Failed to update customer: ${errorMessage}`);
    }
  };

  // INVENTORY EDIT & DELETE HANDLERS
  const handleDeleteInventory = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Are you sure you want to delete inventory item "${itemName}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/inventory/${itemId}`);
      alert('Inventory item deleted successfully!');
      fetchData();
    } catch (err: any) {
      console.error('Error deleting inventory item:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err.message;
      alert(`Failed to delete inventory item: ${errorMessage}`);
    }
  };

  const handleUpdateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInventory) return;

    try {
      await axios.put(`/api/inventory/${editingInventory.id}`, editingInventory);
      alert('Inventory item updated successfully!');
      setEditingInventory(null);
      fetchData();
    } catch (err: any) {
      console.error('Error updating inventory item:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err.message;
      alert(`Failed to update inventory item: ${errorMessage}`);
    }
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('hvac_branding', JSON.stringify(branding));
    setIsBrandingModalOpen(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBranding(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/inventory', newPart);
      setNewPart({ name: '', description: '', quantity: 0, unit_cost: 0, reorder_level: 5, purchase_date: new Date().toISOString().slice(0, 10) });
      fetchData();
    } catch (err) {
      alert('Failed to register new inventory part.');
    }
  };

  const downloadMonthlyReport = async () => {
    setIsExporting(true);
    try {
      const [scrapRes, expensesRes] = await Promise.all([
        axios.get('/api/scrap'),
        axios.get<Expense[]>('/api/expenses')
      ]);
      const scrapItems = scrapRes.data || [];
      const expenses = expensesRes.data || [];
      const monthInvoices = invoices.filter(invoice => (invoice.date || invoice.created_at || '').startsWith(reportMonth));
      const monthCustomers = customers.filter(customer => (customer.created_at || '').startsWith(reportMonth));
      const monthInventory = inventory.filter(item => (item.purchase_date || '').startsWith(reportMonth));
      const monthScrap = scrapItems.filter((item: any) => (item.acquired_date || '').startsWith(reportMonth) || (item.sold_date || '').startsWith(reportMonth));
      const monthExpenses = expenses.filter(expense => expense.date.startsWith(reportMonth));
      const scrapPurchases = monthExpenses.filter(expense => expense.category === 'Scrap Purchase');
      const scrapSales = monthExpenses.filter(expense => expense.category === 'Scrap Sale Revenue');
      const inventoryPurchaseTotal = monthInventory.reduce((total, item) => total + item.quantity * item.unit_cost, 0);
      const invoiceRevenue = monthInvoices.reduce((total, invoice) => total + invoice.total_amount, 0);
      const scrapRevenue = scrapSales.reduce((total, expense) => total - expense.amount, 0);
      const totalRevenue = invoiceRevenue + scrapRevenue;
      const totalExpenses = inventoryPurchaseTotal + scrapPurchases.reduce((total, expense) => total + expense.amount, 0) + monthExpenses
        .filter(expense => !['Scrap Purchase', 'Scrap Sale Revenue'].includes(expense.category) && expense.amount > 0)
        .reduce((total, expense) => total + expense.amount, 0);

      const workbook = XLSX.utils.book_new();
      const summaryRows = [
        ['HVAC ERP Monthly Summary', reportMonth],
        [],
        ['Metric', 'Value'],
        ['New customers', monthCustomers.length],
        ['Invoices generated', monthInvoices.length],
        ['Inventory purchase records', monthInventory.length],
        ['Inventory purchases (Rs.)', inventoryPurchaseTotal],
        ['Scrap purchases (Rs.)', scrapPurchases.reduce((total, expense) => total + expense.amount, 0)],
        ['Scrap sales (Rs.)', scrapRevenue],
        ['Total revenue (Rs.)', totalRevenue],
        ['Total expenses (Rs.)', totalExpenses],
        ['Net result (Rs.)', totalRevenue - totalExpenses]
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthCustomers), 'Customers');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthInvoices), 'Invoices');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthInventory.map(item => ({
        Name: item.name,
        Description: item.description,
        Quantity: item.quantity,
        'Unit Cost': item.unit_cost,
        'Total Cost': item.quantity * item.unit_cost,
        'Purchase Date': item.purchase_date || ''
      }))), 'Inventory Purchases');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthScrap), 'Scrap Activity');

      const accountRows = [
        ...monthInvoices.map(invoice => ({ Date: invoice.date || invoice.created_at || '', Type: 'Invoice Revenue', Description: invoice.id, Debit: 0, Credit: invoice.total_amount, Net: invoice.total_amount })),
        ...monthInventory.map(item => ({ Date: item.purchase_date || '', Type: 'Inventory Purchase', Description: item.name, Debit: item.quantity * item.unit_cost, Credit: 0, Net: -(item.quantity * item.unit_cost) })),
        ...monthExpenses.map(expense => ({ Date: expense.date, Type: expense.category, Description: expense.notes, Debit: expense.amount > 0 ? expense.amount : 0, Credit: expense.amount < 0 ? -expense.amount : 0, Net: -expense.amount }))
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(accountRows), 'Accounts');
      XLSX.writeFile(workbook, `hvac-erp-${reportMonth}-summary.xlsx`);
    } catch (error) {
      console.error('Failed to export monthly report:', error);
      alert('Failed to create the monthly Excel report.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/customers', newCustomer);
      setNewCustomer({ name: '', phone: '', address: '', email: '' });
      fetchData();
    } catch (err) {
      alert('Failed to save client profile.');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/expenses', newExpense);
      setNewExpense({ date: new Date().toISOString().slice(0, 10), amount: 0, notes: '' });
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save daily expense.');
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      const itemsRes = await axios.get<InvoiceItem[]>(`/api/invoices/${invoice.id}/items`);
      const cust = customers.find(c => c.id === invoice.customer_id);
      setSelectedInvoice({
        invoice,
        customer: cust,
        items: itemsRes.data
      });
      setPaymentAmount(invoice.paid_amount || 0);
    } catch (err) {
      alert('Failed to fetch invoice detail payload.');
    }
  };

  const handleToggleCustomerBusiness = async (customerId: string) => {
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId(null);
      return;
    }

    setExpandedCustomerId(customerId);
    if (customerBusiness[customerId]) return;

    try {
      await refreshCustomerBusiness(customerId);
    } catch (err) {
      setExpandedCustomerId(null);
      alert('Failed to fetch customer business history.');
    } finally {
      setLoadingCustomerBusinessId(null);
    }
  };

  const filteredInvoices = selectedMonthFilter === 'all' 
    ? invoices 
    : invoices.filter(inv => (inv.created_at || inv.date || '').startsWith(selectedMonthFilter));

  const dailyExpenses = expenses.filter(expense => expense.category === 'Daily Expense');
  const dailyExpenseTotal = dailyExpenses.reduce((total, expense) => total + expense.amount, 0);

  const formatDate = (rawDate?: string) => {
    if (!rawDate) return 'N/A';
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? rawDate : d.toLocaleDateString();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER BAR WITH BRANDING LOGO */}
      <header className="no-print dashboard-header" style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {branding.logoUrl && (
            <img 
              src={branding.logoUrl} 
              alt="Company Logo" 
              style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#000000', padding: '4px', border: '1px solid #1f2937' }} 
            />
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {branding.name}
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {branding.tagline}
            </p>
          </div>
        </div>

        <div className="dashboard-header-actions">
          <div className="dashboard-report-controls">
            <span className="dashboard-report-label">Monthly report</span>
            <input className="modern-input dashboard-month-input" type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} aria-label="Report month" />
            <button className="btn-secondary dashboard-export-button" onClick={downloadMonthlyReport} disabled={isExporting}>
              {isExporting ? 'Preparing...' : 'Download Excel'}
            </button>
          </div>
          <button className="btn-secondary dashboard-settings-button" onClick={() => setIsBrandingModalOpen(true)}>
            ⚙ Settings & Logo
          </button>
          <button className="btn-primary dashboard-invoice-button" onClick={onOpenInvoiceCreator}>
            + Create Invoice
          </button>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {fetchError && (
          <div role="alert" style={{ marginBottom: '24px', padding: '12px 16px', border: '1px solid #ef4444', borderRadius: '8px', color: '#fecaca', backgroundColor: '#450a0a' }}>
            {fetchError}
          </div>
        )}
        
        {/* METRICS DASHBOARD CARDS */}
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>This Month Net Ledger</span>
            <div className="mono-text" style={{ fontSize: '1.8rem', fontWeight: 700, color: thisMonthSummary.netEarnings >= 0 ? 'var(--accent-green)' : '#ef4444', marginTop: '8px' }}>
              Rs. {thisMonthSummary.netEarnings.toLocaleString()}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Lifetime Net Ledger</span>
            <div className="mono-text" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '8px' }}>
              Rs. {lifetimeSummary.netEarnings.toLocaleString()}
            </div>
          </div>
          
          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Invoices Generated</span>
            <div className="mono-text" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '8px' }}>
              {invoices.length}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Clients</span>
            <div className="mono-text" style={{ fontSize: '1.8rem', fontWeight: 700, color: '#a855f7', marginTop: '8px' }}>
              {customers.length}
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="no-print" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
          {(['inventory', 'customers', 'invoices', 'workshop', 'scrap'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--accent-cyan)' : 'var(--text-muted)',
                padding: '12px 20px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.95rem',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease'
              }}
            >
              {tab === 'workshop' ? 'Workshop Repair Log' : tab === 'scrap' ? 'Scrap Inventory' : `${tab} Log`}
            </button>
          ))}
        </div>

        {/* TAB 1: INVENTORY MANAGEMENT */}
        {activeTab === 'inventory' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            <div className="glass-card" style={{ padding: '24px', height: 'fit-content' }}>
              <h3 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '16px' }}>Add New Spare Part</h3>
              <form onSubmit={handleAddPart} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Item Name</label>
                  <input className="modern-input" type="text" required value={newPart.name} onChange={e => setNewPart({ ...newPart, name: e.target.value })} placeholder="e.g., 1.5 Ton Compressor" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Description</label>
                  <input className="modern-input" type="text" value={newPart.description} onChange={e => setNewPart({ ...newPart, description: e.target.value })} placeholder="e.g., R32 Rotary Brand" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Initial Stock Qty</label>
                    <input className="modern-input" type="number" required min="0" value={newPart.quantity} onChange={e => setNewPart({ ...newPart, quantity: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Unit Cost (Rs.)</label>
                    <input className="modern-input" type="number" required min="0" value={newPart.unit_cost} onChange={e => setNewPart({ ...newPart, unit_cost: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Reorder Threshold</label>
                  <input className="modern-input" type="number" required min="1" value={newPart.reorder_level} onChange={e => setNewPart({ ...newPart, reorder_level: parseInt(e.target.value) || 5 })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Purchase Date</label>
                  <input className="modern-input" type="date" required value={newPart.purchase_date} onChange={e => setNewPart({ ...newPart, purchase_date: e.target.value })} />
                </div>
                <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>Save Inventory Item</button>
              </form>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '16px' }}>Warehouse Stock</h3>
              <table className="modern-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Part Details</th>
                    <th>In Stock</th>
                    <th>Unit Cost</th>
                    <th>Retail Price (+50%)</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No inventory parts registered yet.
                      </td>
                    </tr>
                  ) : (
                    inventory.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.description}</div>
                        </td>
                        <td className="mono-text" style={{ fontWeight: 600 }}>{item.quantity}</td>
                        <td className="mono-text">Rs. {item.unit_cost.toLocaleString()}</td>
                        <td className="mono-text" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                          Rs. {(item.unit_cost * 1.5).toLocaleString()}
                        </td>
                        <td>
                          {item.quantity <= item.reorder_level ? (
                            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                              LOW STOCK
                            </span>
                          ) : (
                            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                              AVAILABLE
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }} 
                              onClick={() => setEditingInventory(item)}
                            >
                              Edit
                            </button>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }} 
                              onClick={() => handleDeleteInventory(item.id, item.name)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: CLIENT DIRECTORY */}
        {activeTab === 'customers' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            <div className="glass-card" style={{ padding: '24px', height: 'fit-content' }}>
              <h3 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '16px' }}>Add Client Profile</h3>
              <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Full Name / Workshop</label>
                  <input className="modern-input" type="text" required value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="e.g., Malik Air Conditioning Services" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                  <input className="modern-input" type="text" required value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="e.g., 0300-9876543" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email Address</label>
                  <input className="modern-input" type="email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="e.g., client@domain.pk" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Physical Address</label>
                  <textarea className="modern-input" rows={3} value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Street address, City" />
                </div>
                <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>Register Customer</button>
              </form>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '16px' }}>Client Accounts</h3>
              <table className="modern-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Address</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No client profiles saved yet.
                      </td>
                    </tr>
                  ) : (
                    customers.map(c => (
                      <React.Fragment key={c.id}>
                      <tr>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td className="mono-text">{c.phone}</td>
                        <td>{c.email || 'N/A'}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.address}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }} 
                              onClick={() => setEditingCustomer(c)}
                            >
                              Edit
                            </button>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }} 
                              onClick={() => handleDeleteCustomer(c.id, c.name)}
                            >
                              Delete
                            </button>
                            <button
                              className="btn-secondary customer-business-button"
                              aria-expanded={expandedCustomerId === c.id}
                              onClick={() => handleToggleCustomerBusiness(c.id)}
                            >
                              <span>{expandedCustomerId === c.id ? 'Hide Business' : 'View Business'}</span>
                              <span className="customer-business-chevron" aria-hidden="true">⌄</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedCustomerId === c.id && (
                        <tr>
                          <td colSpan={5} className="customer-business-cell">
                            <div className="customer-business-panel">
                            {loadingCustomerBusinessId === c.id ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading business history...</span>
                            ) : customerBusiness[c.id] && (
                              <div>
                                <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                  <span><strong>Total Billed:</strong> <span className="mono-text">Rs. {customerBusiness[c.id].total_billed.toLocaleString()}</span></span>
                                  <span><strong>Total Collected:</strong> <span className="mono-text" style={{ color: 'var(--accent-green)' }}>Rs. {customerBusiness[c.id].total_collected.toLocaleString()}</span></span>
                                </div>
                                {customerBusiness[c.id].invoices.length === 0 ? (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No invoice business recorded yet.</span>
                                ) : (
                                  <table className="modern-table" style={{ marginTop: 0 }}>
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Invoice</th>
                                        <th>Services</th>
                                        <th>Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {customerBusiness[c.id].invoices.map(invoice => (
                                        <tr key={invoice.id}>
                                          <td>{formatDate(invoice.date)}</td>
                                          <td className="mono-text">{invoice.id}</td>
                                          <td>{invoice.services}</td>
                                          <td className="mono-text">Rs. {invoice.total_amount.toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INVOICE ARCHIVE LOG */}
        {activeTab === 'invoices' && (
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Completed Transaction Ledger</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filter Month:</span>
                <select 
                  value={selectedMonthFilter} 
                  onChange={(e) => setSelectedMonthFilter(e.target.value)}
                  className="modern-input"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  <option value="all">All-Time (Cumulative)</option>
                  <option value="2026-09">September 2026</option>
                  <option value="2026-08">August 2026</option>
                </select>
              </div>
            </div>
            
            <table className="modern-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Total Billing</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No invoices found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="mono-text" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{inv.id}</td>
                      <td>{formatDate(inv.created_at || inv.date)}</td>
                      <td>{inv.customer_name || inv.customer_id}</td>
                      <td className="mono-text" style={{ fontWeight: 700 }}>Rs. {inv.total_amount?.toLocaleString()}</td>
                      <td>
                        <select
                          value={inv.status || 'unpaid'}
                          onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                          className="modern-input"
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '4px',
                            width: 'auto',
                            cursor: 'pointer',
                            backgroundColor: inv.status === 'paid' ? 'rgba(16, 185, 129, 0.2)' : inv.status === 'partial' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: inv.status === 'paid' ? '#10b981' : inv.status === 'partial' ? '#f59e0b' : '#ef4444',
                            border: 'none'
                          }}
                        >
                          <option value="unpaid">UNPAID</option>
                          <option value="paid">PAID</option>
                          <option value="partial">PARTIAL</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleViewInvoice(inv)}>
                            View & Print
                          </button>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }} 
                            onClick={() => handleDeleteInvoice(inv.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: WORKSHOP REPAIR LOG */}
        {activeTab === 'workshop' && <WorkshopJobs onDataChanged={fetchData} />}

        {/* TAB 5: SCRAP INVENTORY LOG */}
        {activeTab === 'scrap' && <ScrapInventory onDataChanged={fetchData} />}

        {activeTab === 'inventory' && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 2fr)', gap: '20px', marginTop: '32px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Operating Costs</span>
              <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', color: 'var(--text-main)' }}>Add Daily Expense</h3>
            </div>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Date</label>
                <input className="modern-input" type="date" required value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Amount (Rs.)</label>
                <input className="modern-input" type="number" required min="0.01" step="0.01" value={newExpense.amount || ''} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notes</label>
                <input className="modern-input" type="text" required value={newExpense.notes} onChange={e => setNewExpense({ ...newExpense, notes: e.target.value })} placeholder="e.g., Fuel, transport, shop supplies" />
              </div>
              <button type="submit" className="btn-primary">Save Expense</button>
            </form>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <span style={{ color: 'var(--accent-green)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Expense Activity</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', color: 'var(--text-main)' }}>Recent Daily Expenses</h3>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Recorded</span>
                <strong className="mono-text" style={{ display: 'block', marginTop: '3px', color: 'var(--accent-green)', fontSize: '1.15rem' }}>
                  Rs. {dailyExpenseTotal.toLocaleString()}
                </strong>
              </div>
            </div>
            {dailyExpenses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 0 }}>No daily expenses recorded yet.</p>
            ) : (
              <table className="modern-table" style={{ marginTop: '12px' }}>
                <thead>
                  <tr><th>Date</th><th>Notes</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {dailyExpenses.slice(0, 5).map(expense => (
                    <tr key={expense.id}>
                      <td>{formatDate(expense.date)}</td>
                      <td>{expense.notes}</td>
                      <td className="mono-text">Rs. {expense.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        )}
      </main>

      {/* MODAL: EDIT INVENTORY ITEM */}
      {editingInventory && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Edit Spare Part</h3>
            <form onSubmit={handleUpdateInventory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Item Name</label>
                <input 
                  className="modern-input" 
                  type="text" 
                  required 
                  value={editingInventory.name} 
                  onChange={e => setEditingInventory({ ...editingInventory, name: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Description</label>
                <input 
                  className="modern-input" 
                  type="text" 
                  value={editingInventory.description || ''} 
                  onChange={e => setEditingInventory({ ...editingInventory, description: e.target.value })} 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>In Stock Qty</label>
                  <input 
                    className="modern-input" 
                    type="number" 
                    required 
                    min="0" 
                    value={editingInventory.quantity} 
                    onChange={e => setEditingInventory({ ...editingInventory, quantity: parseInt(e.target.value) || 0 })} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Unit Cost (Rs.)</label>
                  <input 
                    className="modern-input" 
                    type="number" 
                    required 
                    min="0" 
                    value={editingInventory.unit_cost} 
                    onChange={e => setEditingInventory({ ...editingInventory, unit_cost: parseFloat(e.target.value) || 0 })} 
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Reorder Threshold</label>
                <input 
                  className="modern-input" 
                  type="number" 
                  required 
                  min="1" 
                  value={editingInventory.reorder_level} 
                  onChange={e => setEditingInventory({ ...editingInventory, reorder_level: parseInt(e.target.value) || 5 })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Purchase Date</label>
                <input className="modern-input" type="date" required value={editingInventory.purchase_date || ''} onChange={e => setEditingInventory({ ...editingInventory, purchase_date: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingInventory(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CUSTOMER */}
      {editingCustomer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Edit Customer Profile</h3>
            <form onSubmit={handleUpdateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Full Name / Workshop</label>
                <input 
                  className="modern-input" 
                  type="text" 
                  required 
                  value={editingCustomer.name} 
                  onChange={e => setEditingCustomer({ ...editingCustomer, name: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                <input 
                  className="modern-input" 
                  type="text" 
                  required 
                  value={editingCustomer.phone} 
                  onChange={e => setEditingCustomer({ ...editingCustomer, phone: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email Address</label>
                <input 
                  className="modern-input" 
                  type="email" 
                  value={editingCustomer.email || ''} 
                  onChange={e => setEditingCustomer({ ...editingCustomer, email: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Physical Address</label>
                <textarea 
                  className="modern-input" 
                  rows={3} 
                  value={editingCustomer.address || ''} 
                  onChange={e => setEditingCustomer({ ...editingCustomer, address: e.target.value })} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingCustomer(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BRANDING & LOGO SETTINGS */}
      {isBrandingModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Custom Workshop Branding & Logo</h3>
            <form onSubmit={handleSaveBranding} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Workshop Logo</label>
                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Business Name</label>
                <input className="modern-input" type="text" value={branding.name} onChange={e => setBranding({ ...branding, name: e.target.value })} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tagline</label>
                <input className="modern-input" type="text" value={branding.tagline} onChange={e => setBranding({ ...branding, tagline: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                <input className="modern-input" type="text" value={branding.phone} onChange={e => setBranding({ ...branding, phone: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Address</label>
                <input className="modern-input" type="text" value={branding.address} onChange={e => setBranding({ ...branding, address: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>NTN / Registration #</label>
                <input className="modern-input" type="text" value={branding.ntnNumber} onChange={e => setBranding({ ...branding, ntnNumber: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsBrandingModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Branding</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL / PRINT INTERCEPT: DUAL VIEW INVOICE MODAL */}
      {selectedInvoice && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '20px' }}>
          <div style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div className="no-print invoice-toolbar">
              <button className="btn-secondary invoice-toolbar-button" onClick={() => setSelectedInvoice(null)}>← Back to Dashboard</button>
              
              <div className="invoice-toolbar-actions">
                <div className="invoice-payment-controls">
                <label className="invoice-toolbar-label">
                  Status:
                </label>
                <select
                  value={selectedInvoice.invoice.status}
                  onChange={(e) => handleStatusChange(
                    selectedInvoice.invoice.id,
                    e.target.value,
                    e.target.value === 'partial' ? paymentAmount : undefined
                  )}
                  className="modern-input invoice-status-select"
                >
                  <option value="unpaid" style={{ color: '#ef4444' }}>UNPAID</option>
                  <option value="paid" style={{ color: '#10b981' }}>PAID</option>
                  <option value="partial" style={{ color: '#f59e0b' }}>PARTIAL</option>
                </select>

                {selectedInvoice.invoice.status === 'partial' && (
                  <>
                    <label htmlFor="partial-payment-amount" className="invoice-toolbar-label">
                      Paid:
                    </label>
                    <input
                      id="partial-payment-amount"
                      type="number"
                      min="0"
                      max={selectedInvoice.invoice.total_amount}
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                      className="modern-input invoice-payment-input"
                    />
                    <button
                      className="btn-secondary invoice-toolbar-button"
                      onClick={() => handleStatusChange(selectedInvoice.invoice.id, 'partial', paymentAmount)}
                    >
                      Save Amount
                    </button>
                  </>
                )}
                </div>

                <button 
                  className="btn-secondary invoice-toolbar-button invoice-delete-button"
                  onClick={() => handleDeleteInvoice(selectedInvoice.invoice.id)}
                >
                  🗑 Delete
                </button>

                <button className="btn-primary invoice-toolbar-button" onClick={() => window.print()}>🖨 Print Invoice</button>
              </div>
            </div>

            {/* PRINT & PREVIEW RECEIPT CONTAINER */}
            <div id="printable-invoice" className="glass-card" style={{ padding: '32px', backgroundColor: '#ffffff', color: '#000000', borderRadius: '8px' }}>
              
              {/* PRINT HEADER WITH FIXED LOGO DIMENSIONS */}
              <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px', marginBottom: '20px' }}>
                <div className="print-logo-container" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {branding.logoUrl && (
                    <img 
                      src={branding.logoUrl} 
                      alt="Logo" 
                      className="print-logo" 
                      style={{ width: '70px', height: '70px', objectFit: 'contain', borderRadius: '6px' }} 
                    />
                  )}
                  <div className="print-company-title">
                    <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#111827', fontWeight: 800 }}>{branding.name}</h1>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem', color: '#4b5563' }}>{branding.tagline}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>{branding.address} | Ph: {branding.phone}</p>
                  </div>
                </div>
                <div className="print-meta-box" style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827', letterSpacing: '0.05em' }}>INVOICE</h2>
                  <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: '4px' }}><strong>Invoice #:</strong> {selectedInvoice.invoice.id}</div>
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}><strong>Date:</strong> {formatDate(selectedInvoice.invoice.created_at || selectedInvoice.invoice.date)}</div>
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}><strong>NTN:</strong> {branding.ntnNumber}</div>
                </div>
              </div>

              {/* CLIENT DETAILS SECTION */}
              <div className="print-grid" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Billed To:</span>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px', color: '#111827' }}>
                    {selectedInvoice.customer ? selectedInvoice.customer.name : selectedInvoice.invoice.customer_name || 'Walk-in Client'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}>{selectedInvoice.customer?.phone}</div>
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}>{selectedInvoice.customer?.address}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Payment Status:</span>
                  <div style={{ 
                    fontWeight: 700, 
                    fontSize: '1rem', 
                    marginTop: '2px', 
                    color: selectedInvoice.invoice.status === 'paid' ? '#10b981' : selectedInvoice.invoice.status === 'partial' ? '#f59e0b' : '#ef4444' 
                  }}>
                    {(selectedInvoice.invoice.status || 'unpaid').toUpperCase()}
                  </div>
                </div>
              </div>
{/* ITEMIZED TABLE */}
              <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #374151', textAlign: 'left' }}>
                    <th style={{ padding: '8px 4px', fontSize: '0.85rem' }}>Type</th>
                    <th style={{ padding: '8px 4px', fontSize: '0.85rem' }}>Description</th>
                    <th style={{ padding: '8px 4px', fontSize: '0.85rem', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 4px', fontSize: '0.85rem', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '8px 4px', fontSize: '0.85rem', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px 4px', fontSize: '0.85rem', textTransform: 'capitalize' }}>{item.type}</td>
                      <td style={{ padding: '8px 4px', fontSize: '0.85rem' }}>{item.description}</td>
                      <td style={{ padding: '8px 4px', fontSize: '0.85rem', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 4px', fontSize: '0.85rem', textAlign: 'right' }} className="mono-text">Rs. {item.unit_price.toLocaleString()}</td>
                      <td style={{ padding: '8px 4px', fontSize: '0.85rem', textAlign: 'right' }} className="mono-text">Rs. {(item.quantity * item.unit_price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TOTALS & WARRANTY */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px', borderTop: '2px solid #e5e7eb', paddingTop: '16px' }}>
                <div style={{ maxWidth: '350px' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Warranty & Notes:</span>
                  <p style={{ fontSize: '0.8rem', color: '#374151', margin: '4px 0 0 0' }}>{selectedInvoice.invoice.warranty_terms || 'Standard workshop warranty applies to repairs and replaced parts.'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '4px' }}>
                    <strong>Total Amount:</strong> <span className="mono-text" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111827' }}>Rs. {selectedInvoice.invoice.total_amount?.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '4px' }}>
                    <strong>Paid Amount:</strong> <span className="mono-text">Rs. {(selectedInvoice.invoice.paid_amount || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                    <strong>Balance Due:</strong> <span className="mono-text" style={{ fontWeight: 700 }}>Rs. {(selectedInvoice.invoice.total_amount - (selectedInvoice.invoice.paid_amount || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
