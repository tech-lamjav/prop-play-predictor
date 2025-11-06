# Smart Betting - Setup Guide

This guide will walk you through setting up your Smart Betting application.

## 🚀 Quick Setup Checklist

- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Test the application
- [ ] Deploy to production

## 📋 Prerequisites

Before you begin, make sure you have:

1. **Node.js 18+** installed on your machine
2. **Supabase** account for authentication
3. **Git** for version control

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

# PostHog Analytics Configuration
VITE_PUBLIC_POSTHOG_KEY=your-posthog-project-api-key
VITE_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

## 🧪 Step 3: Test the Application

1. **Start the development server**
   ```bash
   yarn dev
   # or
   npm run dev
   ```

2. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Check the browser console for any errors

## 🚀 Step 4: Deploy to Production

### Deploy to Vercel

1. **Connect your repository**
   - Go to [Vercel](https://vercel.com)
   - Import your GitHub repository

2. **Configure environment variables**
   - Add all your `.env` variables in Vercel dashboard

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

#### 1. Authentication Errors
```
Failed to initialize Supabase client
```

**Solution**: Check your `.env` file and make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly.

#### 2. Environment Variables Not Loading
```
Environment variable is undefined
```

**Solution**: 
- Make sure your `.env` file is in the root directory
- Restart your development server after changing `.env`
- In Vite, environment variables must start with `VITE_` to be accessible in the frontend

### Debug Mode

Enable debug logging by adding this to your `.env`:

```bash
VITE_DEBUG=true
```

## 📚 Next Steps

After successful setup:

1. **Configure Supabase** with your database schema
2. **Set up PostHog** analytics tracking
3. **Customize the application** to your needs
4. **Add real-time data updates**
5. **Set up monitoring and analytics**

## 🆘 Getting Help

If you encounter issues:

1. **Check the browser console** for error messages
2. **Verify your environment variables** are correct
3. **Check the Supabase dashboard** for any configuration issues
4. **Create an issue** in the GitHub repository

## 🔐 Security Notes

- **Never commit your `.env` file** to version control
- **Use environment variables** for all sensitive configuration
- **Monitor your usage** to prevent unexpected charges

---

Happy coding! 🎯
