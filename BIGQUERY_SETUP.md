# BigQuery Integration Setup Guide

This guide will help you set up BigQuery integration for your Prop Play Predictor application.

## Prerequisites

1. **Google Cloud Platform Account** with BigQuery enabled
2. **Supabase Project** with the wrappers extension
3. **BigQuery Dataset** with NBA data tables

## Step 1: BigQuery Setup

### 1.1 Create BigQuery Dataset

```sql
-- In BigQuery Console, create a dataset called 'nba_data'
CREATE SCHEMA IF NOT EXISTS nba_data
OPTIONS (
  description = "NBA data for prop betting analysis",
  location = "US"
);
```

### 1.2 Create Required Tables

```sql
-- Player Statistics Table
CREATE TABLE nba_data.player_stats (
  player_id STRING,
  player_name STRING,
  team STRING,
  position STRING,
  game_date DATE,
  points NUMERIC,
  assists NUMERIC,
  rebounds NUMERIC,
  steals NUMERIC,
  blocks NUMERIC,
  turnovers NUMERIC,
  fouls NUMERIC,
  minutes_played NUMERIC,
  fg_made NUMERIC,
  fg_attempted NUMERIC,
  threes_made NUMERIC,
  threes_attempted NUMERIC,
  ft_made NUMERIC,
  ft_attempted NUMERIC,
  plus_minus NUMERIC,
  efficiency NUMERIC,
  season STRING
);

-- Betting Lines Table
CREATE TABLE nba_data.betting_lines (
  player_id STRING,
  player_name STRING,
  stat_type STRING,
  line NUMERIC,
  over_odds NUMERIC,
  under_odds NUMERIC,
  game_date DATE,
  bookmaker STRING,
  last_updated TIMESTAMP
);

-- Team Lineups Table
CREATE TABLE nba_data.team_lineups (
  team_id STRING,
  team_name STRING,
  game_date DATE,
  player_id STRING,
  player_name STRING,
  position STRING,
  status STRING,
  avg_points NUMERIC,
  avg_assists NUMERIC,
  avg_rebounds NUMERIC
);

-- Game Schedule Table
CREATE TABLE nba_data.game_schedule (
  game_id STRING,
  home_team STRING,
  away_team STRING,
  game_date DATE,
  game_time STRING,
  venue STRING,
  status STRING
);
```

## Step 2: Service Account Setup

### 2.1 Create Service Account

1. Go to Google Cloud Console
2. Navigate to IAM & Admin > Service Accounts
3. Create a new service account with the following roles:
   - BigQuery Data Viewer
   - BigQuery Job User
   - BigQuery Data Editor (if you need write access)

### 2.2 Download Service Account Key

1. Click on the service account
2. Go to Keys tab
3. Create a new JSON key
4. Download and securely store the key file

## Step 3: Supabase Configuration

### 3.1 Store Credentials in Vault

```sql
-- In Supabase SQL Editor, store your service account key in Vault
SELECT vault.create_secret(
  '{
    "type": "service_account",
    "project_id": "your_gcp_project_id",
    "private_key_id": "your_private_key_id",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "client_email": "your_service_account@your_project.iam.gserviceaccount.com",
    "client_id": "your_client_id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your_service_account%40your_project.iam.gserviceaccount.com"
  }',
  'bigquery',
  'BigQuery service account for NBA data access'
);
```

### 3.2 Update Migration File

Update the migration file `002_setup_bigquery_wrapper.sql` with your actual credentials:

```sql
-- Replace 'your_vault_key_id' with the key ID from the vault.create_secret result
-- Replace 'your_gcp_project_id' with your actual GCP project ID
-- Replace 'your_gcp_dataset_id' with your actual BigQuery dataset ID
```

## Step 4: Environment Variables

Create a `.env.local` file in your project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# BigQuery Configuration
VITE_BIGQUERY_PROJECT_ID=your_gcp_project_id
VITE_BIGQUERY_DATASET_ID=nba_data
VITE_BIGQUERY_LOCATION=US
```

## Step 5: Run Migrations

```bash
# Apply the BigQuery wrapper migration
supabase db push

# Or if using the CLI
supabase migration up
```

## Step 6: Test the Integration

### 6.1 Test BigQuery Connection

```sql
-- In Supabase SQL Editor
SELECT * FROM bigquery.player_stats LIMIT 5;
```

### 6.2 Test Service Layer

```typescript
// In your React component
import { usePlayerStats } from '@/hooks/use-player-stats';

const { playerAnalysis, isLoading, error } = usePlayerStats({
  playerId: 'player_id_here',
  autoFetch: true
});
```

## Data Population

### Sample Data Insertion

```sql
-- Insert sample player stats data
INSERT INTO nba_data.player_stats VALUES
('player_001', 'Luka Dončić', 'DAL', 'PG', '2024-01-15', 28.4, 8.7, 8.1, 1.2, 0.5, 3.2, 2.1, 35.2, 10.1, 20.3, 3.2, 8.1, 5.0, 6.1, 5.2, 0.58, '2023-24'),
('player_002', 'LeBron James', 'LAL', 'SF', '2024-01-15', 25.1, 7.8, 7.2, 1.1, 0.6, 3.5, 1.8, 33.1, 9.8, 18.9, 2.1, 6.2, 4.2, 5.8, 3.1, 0.55, '2023-24');

-- Insert sample betting lines
INSERT INTO nba_data.betting_lines VALUES
('player_001', 'Luka Dončić', 'points', 27.5, -110, -110, '2024-01-18', 'DraftKings', '2024-01-15 10:00:00'),
('player_001', 'Luka Dončić', 'assists', 8.5, -105, -115, '2024-01-18', 'DraftKings', '2024-01-15 10:00:00');
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure your service account has the correct BigQuery permissions
2. **Table Not Found**: Verify table names and dataset ID in your BigQuery project
3. **Authentication Error**: Check that your service account key is correctly stored in Vault
4. **Query Timeout**: Large queries may timeout; consider adding LIMIT clauses

### Debug Queries

```sql
-- Check if BigQuery wrapper is working
SELECT * FROM information_schema.foreign_tables 
WHERE foreign_server_name = 'bigquery_server';

-- Test a simple query
SELECT COUNT(*) FROM bigquery.player_stats;
```

## Security Best Practices

1. **Never commit service account keys** to version control
2. **Use Vault** for storing sensitive credentials
3. **Implement Row Level Security** for data access control
4. **Monitor query costs** in BigQuery console
5. **Set up query quotas** to prevent runaway costs

## Next Steps

1. Populate your BigQuery tables with real NBA data
2. Implement data refresh mechanisms
3. Add error handling and retry logic
4. Set up monitoring and alerting
5. Optimize queries for performance
