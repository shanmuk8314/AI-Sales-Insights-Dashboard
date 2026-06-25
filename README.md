# Mediwave AI Sales Insights Dashboard

A premium business intelligence and pharmaceutical sales analytics dashboard built with Node.js, Express, React, PostgreSQL, and Google Gemini AI. 

Designed for pharmaceutical sales managers and corporate executives, this application parses raw invoice sales CSV logs and compiles real-time visual trends, regional distribution charts, MOM key performance indicators, and generative AI strategic executive briefing summaries.

---

## 🌟 Key Features

* **Interactive Analytics Summary**: Dynamic dashboard widgets track gross revenues, total invoices processed, units sold, top-performing drugs, and weakest distribution territories.
* **Region, Product, and Month Filtering**: Instantly isolate and analyze subsets of data. Selecting dropdown filters recalculates all KPI cards, Recharts plots, recent transactions, and AI insights in real-time.
* **Google Gemini AI Executive Briefings**: Generates senior analyst-style qualitative briefings explaining revenue drivers, product rankings, regional bottlenecks, and tactical suggestions.
* **Active Database Failover Heuristics**: Direct integration with PostgreSQL. In the event of connection offline statuses, the backend automatically falls back to in-memory JSON file-based queries, ensuring 100% application uptime.
* **Professional PDF Strategic Report Exports**: Download custom dark-themed A4 sales report PDFs containing overall KPIs, executive AI summaries, and prioritized business recommendations.
* **PNG Chart Downloads**: High-definition exporter captures and downloads Recharts SVG trend plots as PNG files with matching dark theme slate backgrounds.
* **CSV Schema Validation Engine**: Multi-tiered parsing checks headers, duplicate columns, blank files, negative values, and date ranges before records insert.
* **Responsive Collapsible Sidebar & Mobile Drawer Overlay**: Perfect visual layouts optimized at **320px**, **768px**, **1024px**, and standard desktops.

---

## 🛠️ Technology Stack

* **Frontend**: React 19, Vite, Recharts (Plots), jsPDF (PDF Engine), Lucide React (Iconography), react-hot-toast (UX Glassmorphic Notifications)
* **Backend**: Node.js, Express.js, Multer (Multipart parser), csv-parser (Stream parsing), pg (PostgreSQL Client)
* **Database**: PostgreSQL (Primary), Local JSON file failovers (Uptime fallback)
* **AI Integration**: Google Generative AI (Gemini Pro API)

---

## 📂 Project Structure

```text
AI-Sales-Insights-Dashboard/
├── backend/
│   ├── config/             # DB connectivity & schema.sql definitions
│   ├── controllers/        # Express handlers (Sales, Uploads, AI, Insights)
│   ├── models/             # PostgreSQL aggregate models and local JSON mock failovers
│   ├── routes/             # REST routing middleware registrations
│   ├── services/           # External service calls (Gemini AI SDK integrations)
│   ├── utils/              # Heuristic computations (Revenue Growth calculation)
│   ├── uploads/            # Temporary CSV uploads destination & local backup DBs
│   ├── server.js           # Server startup script
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Visual dashboard widgets (Charts, KPIs, Navbar)
│   │   ├── pages/          # Core pages (DashboardPage, InsightsPage, UploadPage, AboutPage)
│   │   ├── utils/          # Client exports helpers (PDF / PNG generators)
│   │   ├── App.jsx         # App router and toast container context
│   │   └── index.css       # Tailwind-free custom CSS glassmorphism styling
│   └── package.json
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18+) and [PostgreSQL](https://www.postgresql.org/) (v14+) installed and running locally.

### 1. Database Setup
Create a PostgreSQL database and execute the schema definitions:
```bash
# Connect to your postgres prompt
psql -U postgres

# Create the database
CREATE DATABASE sales_insights_db;
\c sales_insights_db;

# Run the schema definitions from backend/config/schema.sql
\i backend/config/schema.sql
```

### 2. Environment Variables configuration
Create a `.env` file in the `/backend` directory:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/sales_insights_db
GEMINI_API_KEY=your_gemini_api_key_here
```
*Note: If `GEMINI_API_KEY` is omitted or invalid, the system automatically falls back to local rule-based analytical recommendations.*

### 3. Run the Backend API Server
```bash
cd backend
npm install
npm run dev
```
The server will run on `http://localhost:5000`.

### 4. Run the Frontend Client
```bash
cd ../frontend
npm install
npm run dev
```
The client Vite server will start on `http://localhost:5173`. Any API calls are automatically routed to the backend proxy.

---

## 🔌 API Endpoints Reference

### Sales & History
* `POST /api/upload` - Uploads, validates, and bulk-inserts CSV rows.
* `GET /api/upload-history` - Retrieves list of uploaded files, supports `search` and `sort` parameters.
* `GET /api/filter-options` - Fetches distinct products, regions, and dates populated in the DB.
* `GET /api/analytics-summary` - Returns dashboard metadata (Total uploads, products, regions, last upload date).
* `GET /api/dashboard` - Fetches KPIs, Recharts trends, and recent transaction logs (supports dynamic filters).

### AI & Strategic Heuristics
* `GET /api/ai-insights` - Fetches Gemini Pro-compiled strategic analysis briefs (bypasses cache when filtered).
* `GET /api/insights` - Heuristics-based fallback strategic recommendations.

---

## 🤝 Contribution Guide

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/AmazingFeature`.
3. Commit your changes: `git commit -m 'Add some AmazingFeature'`.
4. Push to the branch: `git push origin feature/AmazingFeature`.
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
