import express from 'express';
import textContentRouter from './routes/textContent';
import adminUsersRouter from './routes/admin-users'; // Import the admin-users router
// ... other imports and setup

const app = express();
app.use(express.json());

// ... other app.use() calls

app.use('/api/text-content', textContentRouter);
app.use('/api/admin/users', adminUsersRouter); // Register the admin-users router

// ... rest of server setup and app.listen()