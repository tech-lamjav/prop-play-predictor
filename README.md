# Smart Betting - Prop Play Predictor

A comprehensive sports betting analytics platform focused on NBA player props, built with React, TypeScript, and Google Cloud Storage.

## 🚀 Features

- **Real-time Data Integration**: Connect to Google Cloud Storage for live sports data
- **Advanced Analytics**: Proprietary model for prop bet analysis and edge calculation
- **Multi-language Support**: English and Portuguese interfaces
- **Responsive Design**: Mobile-first approach with modern UI components
- **Authentication**: Secure user management with Supabase
- **Data Caching**: Intelligent caching system for optimal performance
- **Real-time Updates**: Live data synchronization and alerts

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: shadcn/ui, Radix UI, Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Authentication**: Supabase Auth
- **Data Storage**: Google Cloud Storage (REST API)
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation

## 📋 Prerequisites

- Node.js 18+ and npm/bun
- Google Cloud Platform account with Storage API enabled
- Supabase account
- **Important**: Your GCS bucket must be configured for public access or you need API keys

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# App Configuration
VITE_APP_NAME=Smart Betting
VITE_APP_VERSION=1.0.0

# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Cloud Storage Configuration (Browser-Compatible)
VITE_GOOGLE_CLOUD_PROJECT_ID=your-project-id
VITE_GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# Choose ONE of these authentication methods:

# Option 1: API Key (for public buckets or API access)
VITE_GOOGLE_CLOUD_API_KEY=your-api-key

# Option 2: Access Token (for authenticated requests)
VITE_GOOGLE_CLOUD_ACCESS_TOKEN=your-access-token

# Option 3: No authentication (for public buckets only)
# Leave both API_KEY and ACCESS_TOKEN empty
```

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd prop-play-predictor
```

### 2. Install Dependencies

```bash
npm install
# or
bun install
```

### 3. Configure Environment Variables

Copy the `.env.example` file to `.env` and fill in your configuration values.

### 4. Start Development Server

```bash
npm run dev
# or
bun dev
```

The application will be available at `http://localhost:5173`

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
├── lib/               # Utility functions and configurations
├── pages/             # Application pages
├── services/          # Data services and API calls
├── types/             # TypeScript type definitions
└── App.tsx            # Main application component
```

## 🔌 Data Integration

### Google Cloud Storage Setup

#### **Option 1: Public Bucket (Recommended for Development)**
1. **Enable Storage API**: Go to Google Cloud Console and enable the Cloud Storage API
2. **Make Bucket Public**: Set your bucket to public read access
3. **Configure CORS**: Add CORS rules to allow your domain
4. **No Authentication Required**: Set `VITE_GOOGLE_CLOUD_API_KEY` to empty

#### **Option 2: Private Bucket with API Key**
1. **Enable Storage API**: Go to Google Cloud Console and enable the Cloud Storage API
2. **Create API Key**: Generate an API key with Storage Object Viewer permissions
3. **Set API Key**: Use `VITE_GOOGLE_CLOUD_API_KEY` in your environment

#### **Option 3: Private Bucket with OAuth (Advanced)**
1. **Enable Storage API**: Go to Google Cloud Console and enable the Cloud Storage API
2. **Configure OAuth**: Set up OAuth 2.0 credentials
3. **Get Access Token**: Use `VITE_GOOGLE_CLOUD_ACCESS_TOKEN` in your environment

### Data Structure

The application expects the following folder structure in your GCS bucket:

```
your-bucket/
├── players/           # Player information JSON files
├── games/            # Game data JSON files
├── props/            # Prop bet data JSON files
├── analysis/         # Analysis results JSON files
├── injuries/         # Injury report JSON files
└── performance/      # Model performance JSON files
```

### CORS Configuration

If you're using a public bucket, add this CORS configuration:

```json
[
  {
    "origin": ["http://localhost:5173", "https://yourdomain.com"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

## 📊 Data Models

The application uses comprehensive TypeScript interfaces for:

- **Players**: Basic player information and statistics
- **Games**: Game schedules, scores, and status
- **Prop Bets**: Betting lines and odds from various bookmakers
- **Analysis**: Model predictions and edge calculations
- **Injuries**: Player injury reports and status updates
- **Performance**: Historical model performance metrics

## 🎯 Key Features

### Dashboard
- Player search and filtering
- Real-time game status
- Injury alerts
- Watchlist management

### Analysis
- Prop bet analysis with confidence scores
- Historical performance tracking
- Edge calculations
- Risk factor identification

### Data Management
- Automatic data synchronization
- Intelligent caching
- Real-time updates
- Export functionality

## 🔒 Security

- Environment variables for sensitive configuration
- **Browser-compatible authentication** (no private keys in frontend)
- Supabase Row Level Security (RLS)
- Input validation and sanitization
- CORS protection for data access

## 🚀 Deployment

### Build for Production

```bash
npm run build
# or
bun run build
```

### Deploy to Vercel/Netlify

1. Connect your repository to Vercel or Netlify
2. Set environment variables in the deployment platform
3. Deploy automatically on push to main branch

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation in the `/docs` folder

## 🔮 Roadmap

- [ ] Real-time WebSocket integration
- [ ] Advanced charting and visualization
- [ ] Mobile app (React Native)
- [ ] Machine learning model improvements
- [ ] Additional sports support
- [ ] Social features and sharing
- [ ] Advanced analytics dashboard
- [ ] API rate limiting and optimization

## 📊 Performance Metrics

- **Bundle Size**: Optimized with Vite and tree-shaking
- **Loading Time**: Lazy loading and code splitting
- **Data Fetching**: Intelligent caching and background updates
- **Memory Usage**: Efficient state management and cleanup

## ⚠️ Important Notes

### **Browser Compatibility**
- This application uses a **browser-compatible** GCS client
- **No Node.js dependencies** in the frontend
- Works with public buckets or authenticated API access
- **Private keys are never exposed** in the frontend

### **Data Access Patterns**
- **Public Bucket**: Direct file access via URLs
- **Private Bucket**: API key or OAuth token authentication
- **Real-time Updates**: Polling-based updates (configurable intervals)

---

Built with ❤️ by the Smart Betting team
