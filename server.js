require("dotenv").config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
const promClient = require('prom-client');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');
const routes = require('./src/routes');
const { errorHandler } = require('./src/middlewares/errorHandler');
const ApiError = require('./src/utils/ApiError')
const trafficLogger = require('./src/middlewares/trafficLogger');
const { metricsMiddleware } = require('./src/middlewares/metrics');
const ensureAdmin = require('./src/bootstrap/ensureAdmin');
const cron = require('node-cron');
const prisma = require('./src/utils/prisma');

const app = express();
promClient.collectDefaultMetrics();

app.use(helmet());

const corsOptions = {
    origin: ['https://csse2669.cpkku.com','http://localhost:3001',
        'https://amazing-crisp-9bcb1a.netlify.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // เปิดรับ preflight สำหรับทุก route

app.use(express.json());

app.use(trafficLogger);

//Rate Limiting
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100,
//     standardHeaders: true,
//     legacyHeaders: false,
// });
// app.use(limiter);

//Metrics Middleware
app.use(metricsMiddleware);

// --- Routes ---
// Health Check Route
app.get('/health', async (req, res) => {
    try {
        const prisma = require('./src/utils/prisma');
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'ok' });
    } catch (err) {
        res.status(503).json({ status: 'error', detail: err.message });
    }
});

// Prometheus Metrics Route
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

// Swagger Documentation Route
app.use('/documentation', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Main API Routes
app.use('/api', routes);

app.use((req, res, next) => {
    next(new ApiError(404, `Cannot ${req.method} ${req.originalUrl}`));
});

// --- Error Handling Middleware ---
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 3000;
(async () => {
    try {
        await ensureAdmin();
    } catch (e) {
        console.error('Admin bootstrap failed:', e);
    }
})();


cron.schedule('0 0 * * *', async () => {
    try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const deleted = await prisma.trafficLogger.deleteMany({
            where: {
                timestamp: {
                    lt: ninetyDaysAgo
                }
            }
        });
        console.log(`[Cleanup] Deleted ${deleted.count} logs older than 90 days.`);
    } catch (err) {
        console.error('[Cleanup Error]:', err);
    }
});

// Graceful Shutdown
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err);
    process.exit(1);
});


module.exports = app;