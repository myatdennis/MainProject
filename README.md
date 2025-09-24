# LMS Website

A Learning Management System built with React, TypeScript, and Supabase for The Huddle Co.

## Features

- **Authentication**: Secure user authentication with Supabase
- **Learning Management**: Course creation, enrollment, and progress tracking
- **Admin Dashboard**: User management, course administration, and analytics
- **Responsive Design**: Mobile-first responsive interface
- **Demo Mode**: Fallback authentication for development

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/myatdennis/MainProject.git
cd MainProject
npm install
```

### 2. Environment Configuration

#### Option A: Full Supabase Setup (Recommended for Production)

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env.local`
3. Update `.env.local` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Option B: Demo Mode (Development Only)

If you skip the Supabase setup, the application will run in demo mode with these credentials:

- **Admin**: admin@thehuddleco.com / admin123
- **LMS User**: user@pacificcoast.edu / user123
- **LMS Demo**: demo@thehuddleco.com / demo123

### 3. Run the Application

```bash
npm run dev
```

Visit `http://localhost:5173` to access the application.

## Supabase Setup Guide

### Prerequisites

- [Supabase](https://supabase.com) account
- Basic knowledge of SQL (optional)

### Step-by-Step Setup

1. **Create a New Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New project"
   - Choose your organization and set project details
   - Wait for the project to be created

2. **Get Your Project Credentials**
   - Navigate to Settings → API
   - Copy the following:
     - Project URL (VITE_SUPABASE_URL)
     - Project API Key → anon/public (VITE_SUPABASE_ANON_KEY)

3. **Configure Environment Variables**
   ```bash
   # Copy the example file
   cp .env.example .env.local
   
   # Edit .env.local with your credentials
   VITE_SUPABASE_URL=https://miqzywzuqzeffqpiupjm.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcXp5d3p1cXplZmZxcGl1cGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMjM3NzksImV4cCI6MjA3Mzg5OTc3OX0.WTlTJLGNkiXzdjpz0g29DEvHgfJPsBVqVFtI7pDKt5w
   ```

4. **Set Up Database Tables** (Optional)
   
   The application will work for authentication immediately. For full LMS functionality, you can set up additional tables:
   
   ```sql
   -- User profiles table
   CREATE TABLE user_profiles (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     name TEXT,
     email TEXT,
     organization TEXT,
     role TEXT,
     cohort TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Enable Row Level Security
   ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
   
   -- Create policy for users to manage their own profiles
   CREATE POLICY "Users can manage their own profiles" ON user_profiles
     FOR ALL USING (auth.uid() = user_id);
   ```

### Authentication Setup

1. **Enable Email Authentication**
   - Go to Authentication → Settings
   - Under "Auth Providers", ensure Email is enabled
   - Configure email templates if needed

2. **Configure Site URL**
   - Under "Site URL", add: `http://localhost:5173`
   - For production, add your domain

3. **Test Authentication**
   - Run the application: `npm run dev`
   - Try logging in with any email/password
   - Check Supabase Authentication → Users to see new registrations

## Troubleshooting

### Common Issues

#### 1. "Supabase not configured" Error

**Problem**: Application shows "Supabase not configured" messages

**Solutions**:
- Check that `.env.local` file exists in the root directory
- Verify that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly
- Restart the development server after adding environment variables
- Ensure no extra spaces or quotes around the values

#### 2. Authentication Fails

**Problem**: Login attempts fail even with correct credentials

**Solutions**:
- Verify Supabase project is active and accessible
- Check that the anon key has proper permissions
- Ensure Site URL is configured correctly in Supabase settings
- Check browser console for detailed error messages

#### 3. Environment Variables Not Loading

**Problem**: Variables from `.env.local` are not recognized

**Solutions**:
- Ensure file is named exactly `.env.local` (not `.env.local.txt`)
- Variables must start with `VITE_` prefix to be accessible in the frontend
- Restart the development server after making changes
- Check that the file is in the project root directory

#### 4. Demo Mode Not Working

**Problem**: Demo login credentials don't work

**Solutions**:
- Remove or rename `.env.local` to disable Supabase mode
- Use exact credentials:
  - Admin: admin@thehuddleco.com / admin123
  - LMS: user@pacificcoast.edu / user123
- Check browser console for authentication mode messages

### Getting Help

If you encounter issues:

1. Check the browser console for detailed error messages
2. Verify your Supabase project status and configuration
3. Ensure all environment variables are correctly set
4. Try demo mode to isolate configuration issues

For additional support, check the logs in both the application console and Supabase dashboard.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Icons**: Lucide React
- **Build Tool**: Vite
