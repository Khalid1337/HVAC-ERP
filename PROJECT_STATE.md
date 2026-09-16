# PROJECT_STATE.md - HVAC ERP Application

**Current Project Stage**
* Full-Stack MVP Operational: React + Vite TypeScript client paired with an Express + TypeScript Node backend, SQLite database persistence (`erp.db`), custom invoice printing sheets, and modular route handlers.

**Tech Stack**
* **Frontend:** React, TypeScript, Vite, custom CSS / glassmorphism UI
* **Backend:** Node.js, Express, TypeScript, Vitest
* **Database:** SQLite3 (`server/erp.db`)
* **Process Management:** Custom launcher script (`start-erp.sh`)

**Project Directory Structure**
```text
/hvac-erp
├── client/                      # React frontend application
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx              # Root component & routing state
│       ├── main.tsx             # React entry point
│       ├── components/          # UI Modals and Dashboard views
│       │   ├── CustomerModal.tsx
│       │   ├── Dashboard.tsx
│       │   ├── InventoryModal.tsx
│       │   ├── InvoiceCreator.tsx
│       │   └── InvoiceCreator.tsx.save
│       ├── config/
│       │   └── branding.ts      # Company profile & logo configurations
│       └── styles/
│           └── invoice.css      # Print stylesheet rules
│
├── server/                      # Express backend API & SQLite database
│   ├── erp.db                   # SQLite database storage file
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── app.ts               # Express application initialization
│       ├── db.ts                # SQLite database connection & migrations
│       ├── index.ts             # Server entry point
│       ├── routes/              # REST API endpoints
│       │   ├── customers.ts     # Customer CRUD operations
│       │   ├── inventory.ts     # Spare parts & stock level tracking
│       │   └── invoices.ts      # Invoicing, status updates, & items
│       └── __tests__/
│           └── app.test.ts      # Backend integration tests
│
├── start-erp.sh                 # Unified application startup script
├── PROJECT_STATE.md             # Master project architecture & context tracker
└── package.json                 # Root workspace dependencies & scripts
