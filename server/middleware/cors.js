import cors from 'cors';

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://your-production-domain.com']
  : ['http://localhost:3000'];

export default cors({
  origin: allowedOrigins,
  credentials: true,
});
