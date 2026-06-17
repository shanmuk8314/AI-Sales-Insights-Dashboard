-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    sale_date TIMESTAMP,
    product VARCHAR(255),
    category VARCHAR(255),
    region VARCHAR(255),
    units_sold INTEGER,
    unit_price NUMERIC,
    revenue NUMERIC,
    upload_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create upload_history table
CREATE TABLE IF NOT EXISTS upload_history (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255),
    timestamp TIMESTAMP,
    records_count INTEGER,
    revenue NUMERIC,
    upload_id VARCHAR(255),
    summary JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create ai_insights_cache table
CREATE TABLE IF NOT EXISTS ai_insights_cache (
    id SERIAL PRIMARY KEY,
    insights JSONB NOT NULL,
    records_count INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
