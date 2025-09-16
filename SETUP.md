# Smart Betting - Setup Guide

This guide will walk you through setting up your Smart Betting application with Google Cloud Storage integration.

## 🚀 Quick Setup Checklist

- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Set up Google Cloud Storage
- [ ] Configure CORS (if using public bucket)
- [ ] Test the application
- [ ] Deploy to production

## 📋 Prerequisites

Before you begin, make sure you have:

1. **Node.js 18+** installed on your machine
2. **Google Cloud Platform** account with billing enabled
3. **Supabase** account for authentication
4. **Git** for version control

## 🔧 Step 1: Install Dependencies

```bash
# Clone the repository (if you haven't already)
git clone <your-repo-url>
cd prop-play-predictor

# Install dependencies
yarn install
# or
npm install
```

## 🌍 Step 2: Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env

# Edit the file with your values
nano .env
```

### Required Environment Variables

```bash
# App Configuration
VITE_APP_NAME=Smart Betting
VITE_APP_VERSION=1.0.0

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google Cloud Storage Configuration
VITE_GOOGLE_CLOUD_PROJECT_ID=your-project-id
VITE_GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# Choose ONE authentication method:
VITE_GOOGLE_CLOUD_API_KEY=your-api-key
# OR
VITE_GOOGLE_CLOUD_ACCESS_TOKEN=your-access-token
# OR leave both empty for public bucket
```

## ☁️ Step 3: Google Cloud Storage Setup

### Option A: Public Bucket (Recommended for Development)

1. **Go to Google Cloud Console**
   - Navigate to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your project

2. **Enable Storage API**
   - Go to "APIs & Services" > "Library"
   - Search for "Cloud Storage API"
   - Click "Enable"

3. **Create a Bucket**
   - Go to "Cloud Storage" > "Buckets"
   - Click "Create Bucket"
   - Choose a unique name
   - Select "Standard" storage class
   - Choose a location close to your users
   - Click "Create"

4. **Make Bucket Public**
   - Click on your bucket name
   - Go to "Permissions" tab
   - Click "Add" to add a new member
   - Add `allUsers` with "Storage Object Viewer" role
   - Click "Save"

5. **Configure CORS**
   - Go to "CORS configuration" in your bucket
   - Add this configuration:

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

### Option B: Private Bucket with API Key

1. **Follow steps 1-3 from Option A**

2. **Create API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key
   - Set `VITE_GOOGLE_CLOUD_API_KEY` in your `.env` file

3. **Restrict API Key** (Recommended)
   - Click on the API key you just created
   - Under "Application restrictions", select "HTTP referrers"
   - Add your domain(s)
   - Under "API restrictions", select "Restrict key"
   - Select "Cloud Storage API"

### Option C: Private Bucket with OAuth (Advanced)

1. **Follow steps 1-3 from Option A**

2. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Configure OAuth consent screen
   - Set application type to "Web application"
   - Add authorized redirect URIs
   - Copy the client ID and client secret

3. **Get Access Token**
   - Implement OAuth flow in your application
   - Store the access token in `VITE_GOOGLE_CLOUD_ACCESS_TOKEN`

## 📁 Step 4: Data Structure Setup

Create the following folder structure in your GCS bucket:

```
your-bucket/
├── players/           # Player information JSON files
│   ├── lebron-james.json
│   ├── stephen-curry.json
│   └── ...
├── games/            # Game data JSON files
│   ├── game-001.json
│   ├── game-002.json
│   └── ...
├── props/            # Prop bet data JSON files
│   ├── prop-001.json
│   ├── prop-002.json
│   └── ...
├── analysis/         # Analysis results JSON files
│   ├── analysis-001.json
│   ├── analysis-002.json
│   └── ...
├── injuries/         # Injury report JSON files
│   ├── injury-001.json
│   ├── injury-002.json
│   └── ...
└── performance/      # Model performance JSON files
    ├── performance-2024-01.json
    ├── performance-2024-02.json
    └── ...
```

### Sample Data Files

See the `sample-data/` folder for examples of the expected JSON structure.

## 🧪 Step 5: Test the Application

1. **Start the development server**
   ```bash
   yarn dev
   # or
   npm run dev
   ```

2. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Check the browser console for any errors

3. **Test GCS Connection**
   - Open the browser console
   - Look for GCS connection messages
   - Check if data is loading from your bucket

## 🚀 Step 6: Deploy to Production

### Deploy to Vercel

1. **Connect your repository**
   - Go to [Vercel](https://vercel.com)
   - Import your GitHub repository

2. **Configure environment variables**
   - Add all your `.env` variables in Vercel dashboard
   - Make sure to update CORS origins in your GCS bucket

3. **Deploy**
   - Vercel will automatically deploy on push to main branch

### Deploy to Netlify

1. **Connect your repository**
   - Go to [Netlify](https://netlify.com)
   - Connect your GitHub repository

2. **Configure environment variables**
   - Go to Site settings > Environment variables
   - Add all your `.env` variables

3. **Deploy**
   - Netlify will automatically deploy on push to main branch

## 🔍 Troubleshooting

### Common Issues

#### 1. CORS Errors
```
Access to fetch at 'https://storage.googleapis.com/...' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution**: Update your GCS bucket CORS configuration to include your domain.

#### 2. Authentication Errors
```
Failed to initialize GCS client: Missing required GCS environment variables
```

**Solution**: Check your `.env` file and make sure all required variables are set.

#### 3. Bucket Not Found
```
Failed to list files: 404 Not Found
```

**Solution**: 
- Verify your bucket name is correct
- Check if the bucket exists
- Ensure you have proper permissions

#### 4. API Key Restrictions
```
Failed to list files: 403 Forbidden
```

**Solution**: 
- Check if your API key is restricted
- Verify the API key has proper permissions
- Make sure the key is not expired

### Debug Mode

Enable debug logging by adding this to your `.env`:

```bash
VITE_DEBUG=true
```

### Health Check

The application includes a health check function. You can test your GCS connection:

```typescript
import { sportsDataService } from '@/services/sports-data.service';

// Check GCS connection
const isConnected = await sportsDataService.checkGCSConnection();
console.log('GCS Connection:', isConnected);
```

## 📚 Next Steps

After successful setup:

1. **Add your real data** to the GCS bucket
2. **Customize the data models** in `src/types/sports.ts`
3. **Implement your proprietary analysis model**
4. **Add real-time data updates**
5. **Set up monitoring and analytics**

## 🆘 Getting Help

If you encounter issues:

1. **Check the browser console** for error messages
2. **Verify your environment variables** are correct
3. **Test your GCS bucket** manually in the browser
4. **Check the Google Cloud Console** for any restrictions
5. **Create an issue** in the GitHub repository

## 🔐 Security Notes

- **Never commit your `.env` file** to version control
- **Use environment variables** for all sensitive configuration
- **Restrict API keys** to only necessary permissions
- **Enable CORS restrictions** to only allow your domains
- **Monitor your GCS usage** to prevent unexpected charges

---

Happy coding! 🎯










