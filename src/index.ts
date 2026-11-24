import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.routes.js';
import { orgRouter } from './routes/org.routes.js';
import { departmentRouter } from './routes/department.routes.js';
import { userRouter } from './routes/user.routes.js';
import { courseRouter } from './routes/course.routes.js';
import { enrollmentRouter } from './routes/enrollment.routes.js';
import { progressRouter } from './routes/progress.routes.js';
import { assessmentRouter } from './routes/assessment.routes.js';
import { certificateRouter } from './routes/certificate.routes.js';
import { reportRouter } from './routes/report.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount modular API namespaces as per blueprint specification
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/organizations', orgRouter);
app.use('/api/v1/departments', departmentRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/courses', courseRouter);
app.use('/api/v1/enrollments', enrollmentRouter);
app.use('/api/v1/progress', progressRouter);
app.use('/api/v1/assessments', assessmentRouter);
app.use('/api/v1/certificates', certificateRouter);
app.use('/api/v1/reports', reportRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`🚀 ZenLMS Multi-Tenant Backend running on port ${PORT}`);
  console.log(`📡 Ready for requests across all tenant organizations.`);
});
