#!/bin/bash
# OpenClaw Recipes - Deployment Script
# Run this after creating Supabase & Vercel accounts

set -e  # Exit on error

echo "🦞 OpenClaw Recipes - Deployment Script"
echo "========================================"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found!"
    echo "Please create it from .env.example and add your Supabase credentials"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🏗️  Building project..."
npm run build

# Test the build
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "✅ Project is ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Push to GitHub: git push origin main"
echo "2. Deploy to Vercel: vercel --prod"
echo ""
