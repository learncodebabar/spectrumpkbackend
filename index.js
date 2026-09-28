// backend/index.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import dns from "dns";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// ✅ DNS — only in development
// ============================================
if (process.env.NODE_ENV !== 'production') {
    try {
        dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
        console.log('✅ Custom DNS set (development)');
    } catch (err) {
        console.log('⚠️ DNS set failed:', err.message);
    }
}

// ============================================
// IMPORT ROUTES
// ============================================
import adminRoutes from "./routes/adminRoutes.js";
import adminApplicationRoutes from "./routes/adminApplicationRoutes.js";
import agentRoutes from './routes/agentRoutes.js';
import applicationRoutes from "./routes/applicationRoutes.js";
import universityRoutes from './routes/universityRoutes.js';
import programRoutes from "./routes/programRoutes.js";
import agentPaymentRoutes from "./routes/agentPaymentRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import agentDashboardRoutes from "./routes/agentDashboardRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();

// ============================================
// ✅ CORS — Simple, Vercel Safe
// ============================================
app.use(cors({
    origin: [
        'https://scholarship-three-kappa.vercel.app',
        'https://newsoloer.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// ============================================
// BODY PARSERS
// ============================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// STATIC FILES
// ============================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// ✅ MONGODB — Cached Connection
// ============================================
let cachedConnection = null;

const connectDB = async () => {
    // Reuse existing connection if healthy
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }

    try {
        console.log('🔄 Connecting to MongoDB...');

        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error('MONGO_URI not defined in environment variables');

        console.log('URI:', uri.replace(/:[^:@]+@/, ':****@'));

        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000,
            maxPoolSize: 5,
            family: 4,
            dbName: 'dgss',
        });

        cachedConnection = conn;
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📁 Database: ${conn.connection.name}`);
        return conn;

    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        throw error;
    }
};

// ============================================
// ✅ DB MIDDLEWARE — ensure connection on every request
// ============================================
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('❌ DB Middleware Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: err.message
        });
    }
});

// ============================================
// HEALTH CHECK ROUTES
// ============================================
app.get("/", (req, res) => {
    res.json({
        message: "API is running successfully",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: 'OK',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// API ROUTES
// ============================================

// Admin Routes
app.use('/api/admin/dashboard', dashboardRoutes);
app.use("/api/admin", adminApplicationRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/admin/payments', paymentRoutes);

// Agent Routes
app.use('/api/agent/dashboard', agentDashboardRoutes);
app.use('/api/agent', applicationRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/agent/payments', agentPaymentRoutes);

// Public Routes
app.use('/api/universities', universityRoutes);
app.use('/api/programs', programRoutes);

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    console.error('Stack:', err.stack);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// ============================================
// ✅ EXPORT FOR VERCEL
// ============================================
export default app;

// ============================================
// ✅ LOCAL SERVER (development only)
// ============================================
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;

    // ✅ Connect DB first, then start server
    connectDB()
        .then(() => {
            app.listen(PORT, "0.0.0.0", () => {
                console.log(`🚀 Server running on port ${PORT}`);
                console.log(`✅ CORS enabled for whitelisted origins`);
                console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
            });
        })
        .catch((err) => {
            console.error('❌ Failed to connect to MongoDB on startup:', err.message);
            console.error('⚠️ Starting server anyway (DB operations will fail)');

            app.listen(PORT, "0.0.0.0", () => {
                console.log(`🚀 Server running on port ${PORT} (DB disconnected)`);
            });
        });
}