#!/bin/bash

echo "⚡ Starting HVAC ERP System Infrastructure..."

# 1. Start the Express Backend Server in the background
echo "💾 Booting Backend API Engine (Port 5000)..."
cd ~/Desktop/hvac-erp/server
npm run dev & 
BACKEND_PID=$!

# 2. Start the Vite Frontend Client in the background
echo "🎨 Booting Frontend Dashboard UI (Port 5173)..."
cd ~/Desktop/hvac-erp/client
npm run dev &
FRONTEND_PID=$!

echo "🚀 Both services are running!"
echo "📌 View Dashboard at: http://localhost:5173"
echo "👉 Press [Ctrl + C] in this window at any time to turn off both servers safely."

# Failsafe: Catch Ctrl+C to shut down both background processes cleanly
trap "echo -e '\n🛑 Shutting down ERP services...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

# Keep the script alive so it monitors the servers
wait
