import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, runMigrations } from './db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { put } from '@vercel/blob';
import {
  sendApplicationReceivedEmail,
  sendShortlistedEmail,
  sendRegretEmail,
  sendAdminApplicationNotification,
  sendAdminInquiryNotification
} from './emailService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage in memory so it works with Vercel serverless and local fallback
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB file size limit
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|docx|doc/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed.'));
    }
  }
});

const app = express();
const PORT = process.env.PORT || 5050;

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// Run DB table migrations and start the server
const startServer = async () => {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server due to database migration errors:', err);
    process.exit(1);
  }
};

// --- Middleware: Admin Authentication Guard ---
const adminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-password'];
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;
  const correctPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (token === correctPassword) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized access. Please provide the correct admin password.' });
  }
};

// ==========================================
//             Public Endpoints
// ==========================================

// Root endpoint to check API status
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'Shivohara Backend API is running successfully.' });
});

// Get all active job postings
app.get('/api/jobs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, department, type, location, salary, description, requirements, responsibilities, skills, deadline, deadline_completed, created_at FROM jobs WHERE status = $1 ORDER BY created_at DESC',
      ['Active']
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Submit a candidate application
app.post('/api/jobs/:id/apply', upload.single('resume'), async (req, res) => {
  const job_id = parseInt(req.params.id, 10);
  const { name, email, portfolio_url, cover_letter } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Resume file is required.' });
  }

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  try {
    // Validate if the job exists and is active
    const jobCheck = await pool.query('SELECT id, title FROM jobs WHERE id = $1 AND status = $2', [job_id, 'Active']);
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Active job listing not found.' });
    }
    const job = jobCheck.rows[0];

    let resume_url;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const uniqueFilename = `${Date.now()}-${req.file.originalname}`;
      const blob = await put(`resumes/${uniqueFilename}`, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype,
      });
      resume_url = blob.url;
    } else {
      // Fallback: save locally
      const uniqueFilename = `${Date.now()}-${req.file.originalname}`;
      const localPath = path.join(uploadDir, uniqueFilename);
      await fs.promises.writeFile(localPath, req.file.buffer);
      resume_url = `/uploads/${uniqueFilename}`;
    }

    const result = await pool.query(
      'INSERT INTO applications (job_id, name, email, portfolio_url, resume_text, cover_letter) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [job_id, name, email, portfolio_url || '', resume_url, cover_letter || '']
    );

    // Send confirmation email asynchronously (do not block client response)
    sendApplicationReceivedEmail(email, name, job.title).catch(err => {
      console.error('Error sending application received email:', err);
    });

    res.status(201).json({ success: true, application: result.rows[0] });
  } catch (err) {
    console.error('Error submitting application:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Submit a contact inquiry
app.post('/api/inquiries', async (req, res) => {
  const { name, email, serviceType, message } = req.body;

  if (!name || !email || !serviceType || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO inquiries (name, email, service_type, message) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, serviceType, message]
    );
    // Admin notification email suppressed per user request


    res.status(201).json({ success: true, inquiry: result.rows[0] });
  } catch (err) {
    console.error('Error submitting inquiry:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
//             Admin Endpoints
// ==========================================

// Admin Login verification
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === correctPassword) {
    res.json({ success: true, token: correctPassword });
  } else {
    res.status(401).json({ error: 'Incorrect credentials' });
  }
});

// Admin: Get all jobs (including drafts)
app.get('/api/admin/jobs', adminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin jobs:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin: Create a new job listing
app.post('/api/admin/jobs', adminAuth, async (req, res) => {
  const { title, department, type, location, salary, description, requirements, responsibilities, status, skills, deadline, deadline_completed } = req.body;

  if (!title || !department || !type || !location || !description || !requirements || !responsibilities) {
    return res.status(400).json({ error: 'Missing required fields for creating a job.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO jobs (title, department, type, location, salary, description, requirements, responsibilities, status, skills, deadline, deadline_completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [
        title, 
        department, 
        type, 
        location, 
        salary || '', 
        description, 
        requirements, 
        responsibilities, 
        status || 'Active',
        skills || '',
        deadline || '',
        deadline_completed !== undefined ? deadline_completed : false
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin: Update a job listing
app.put('/api/admin/jobs/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, department, type, location, salary, description, requirements, responsibilities, status, skills, deadline, deadline_completed } = req.body;

  if (!title || !department || !type || !location || !description || !requirements || !responsibilities) {
    return res.status(400).json({ error: 'Missing required fields for updating job.' });
  }

  try {
    const result = await pool.query(
      'UPDATE jobs SET title = $1, department = $2, type = $3, location = $4, salary = $5, description = $6, requirements = $7, responsibilities = $8, status = $9, skills = $10, deadline = $11, deadline_completed = $12 WHERE id = $13 RETURNING *',
      [
        title, 
        department, 
        type, 
        location, 
        salary || '', 
        description, 
        requirements, 
        responsibilities, 
        status || 'Active',
        skills || '',
        deadline || '',
        deadline_completed !== undefined ? deadline_completed : false,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job listing not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating job:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin: Delete a job listing
app.delete('/api/admin/jobs/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const result = await pool.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job listing not found.' });
    }
    res.json({ success: true, message: 'Job deleted successfully.', id });
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin: Get all candidate applications
app.get('/api/admin/applications', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id, 
        a.job_id, 
        a.name, 
        a.email, 
        a.portfolio_url, 
        a.resume_text, 
        a.cover_letter, 
        a.status, 
        a.created_at, 
        j.title as job_title,
        j.department as job_department
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin: Update candidate application status
app.put('/api/admin/applications/:id/status', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    const result = await pool.query(
      'UPDATE applications SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application record not found.' });
    }

    const updatedApp = result.rows[0];

    // Fetch the candidate details and corresponding job title to send email
    const appDetailsCheck = await pool.query(
      'SELECT a.name, a.email, j.title as job_title FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = $1',
      [id]
    );

    if (appDetailsCheck.rows.length > 0) {
      const details = appDetailsCheck.rows[0];
      if (status === 'Shortlisted') {
        sendShortlistedEmail(details.email, details.name, details.job_title).catch(err => {
          console.error('Error sending shortlisted email:', err);
        });
      } else if (status === 'Rejected') {
        sendRegretEmail(details.email, details.name, details.job_title).catch(err => {
          console.error('Error sending regret email:', err);
        });
      }
    }

    res.json(updatedApp);
  } catch (err) {
    console.error('Error updating application status:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin: Get all inquiries
app.get('/api/admin/inquiries', adminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inquiries ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin inquiries:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin: Delete a candidate application
app.delete('/api/admin/applications/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const result = await pool.query('DELETE FROM applications WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application record not found.' });
    }
    res.json({ success: true, message: 'Application deleted successfully.', id });
  } catch (err) {
    console.error('Error deleting application:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin: Delete a client inquiry
app.delete('/api/admin/inquiries/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const result = await pool.query('DELETE FROM inquiries WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry record not found.' });
    }
    res.json({ success: true, message: 'Inquiry deleted successfully.', id });
  } catch (err) {
    console.error('Error deleting inquiry:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Global Error Handler caught:', err.message);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size limit exceeded. Max size allowed is 5MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  res.status(400).json({ error: err.message || 'An unexpected error occurred.' });
});

// On Vercel, we export the app. For local/other servers, we start the listener.
if (process.env.VERCEL) {
  console.log('Running on Vercel. Database migrations bypassed on function boot.');
} else {
  startServer();
}

export default app;
