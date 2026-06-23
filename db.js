import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Run initial migration to set up tables
const runMigrations = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('Successfully connected to PostgreSQL.');
    console.log('Running database migrations...');
    
    // Create jobs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        department VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        location VARCHAR(100) NOT NULL,
        salary VARCHAR(100),
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        responsibilities TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create applications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        portfolio_url VARCHAR(255),
        resume_text TEXT NOT NULL,
        cover_letter TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create inquiries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        service_type VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Database migrations completed successfully.');
  } catch (err) {
    console.error('Error running migrations:', err);
    throw err;
  } finally {
    if (client) {
      client.release();
    }
  }
};

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

export { pool, runMigrations };
