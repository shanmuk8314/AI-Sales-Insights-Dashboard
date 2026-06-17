# AI Sales Insights Dashboard (MERN Stack MVP)

This is an internship project for **Mediwave Life Sciences Pvt Ltd**, providing an interactive dashboard to parse sales log CSV sheets, aggregate overall KPIs, plot regional charts, and flag declining product trends.

---

## Project Structure

* `backend/` - Node.js + Express.js backend API server. Connects to MongoDB via Mongoose.
* `frontend/` - React.js + Vite frontend interface using Recharts for data plotting.
* `docs/` - Architecture and calculations explanation files.
* `scratch/` - Staging folders for sample CSVs and test assets.

---

## Quick Start Guide

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v16+) and [MongoDB](https://www.mongodb.com/try/download/community) installed and running locally.

### 1. Run the Backend Server
```bash
cd backend
npm install
npm run dev
```
The backend server runs on `http://localhost:5000` by default.

### 2. Run the Frontend Development Server
```bash
cd frontend
npm install
npm run dev
```
The frontend Vite server runs on `http://localhost:5173`. Any API calls are automatically proxied to the backend.

### 3. Load Sample Data
To view charts and metrics immediately:
1. Open the UI (`http://localhost:5173`).
2. Navigate to **Upload Sales** tab.
3. Select or drag the sample CSV from `scratch/sample_sales.csv`.
4. Click **Upload & Parse CSV**. You will be redirected to the dashboard automatically.

---

## API Endpoints Reference

* `POST /api/upload` - Upload and bulk-insert sale rows from a CSV.
* `GET /api/dashboard` - Get KPI cards, regional charts, and recent transaction logs.
* `GET /api/insights` - Get automated top-performing products, regional shares, and declining products warnings.
