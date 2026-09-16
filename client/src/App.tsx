import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { InvoiceCreator } from './components/InvoiceCreator';
import './styles/invoice.css';

type TabType = 'inventory' | 'customers' | 'invoices' | 'workshop' | 'scrap';

export const App: React.FC = () => {
  const [isInvoiceCreatorOpen, setIsInvoiceCreatorOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('inventory');

  const handleInvoiceCreated = () => {
    setActiveTab('invoices');
    setRefreshKey(prev => prev + 1);
    setIsInvoiceCreatorOpen(false);
  };

  return (
    <div>
      <Dashboard 
        key={refreshKey}
        defaultTab={activeTab}
        onOpenInvoiceCreator={() => setIsInvoiceCreatorOpen(true)} 
      />
      {isInvoiceCreatorOpen && (
        <InvoiceCreator 
          onClose={() => setIsInvoiceCreatorOpen(false)} 
          onInvoiceCreated={handleInvoiceCreated} 
        />
      )}
    </div>
  );
};

export default App;
