import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const seedJobs = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to database. Seeding jobs...');

    // First check if jobs table already has data to prevent duplicate seed entries
    const checkResult = await client.query('SELECT COUNT(*) FROM jobs;');
    const count = parseInt(checkResult.rows[0].count, 10);
    
    if (count > 0) {
      console.log(`The database already has ${count} job listings. Skipping seeding to prevent duplicates.`);
      return;
    }

    const jobs = [
      {
        title: 'Full Stack Engineer',
        department: 'Engineering',
        type: 'Full-time',
        location: 'Virginia (US East) / Remote',
        salary: '$100,000 - $130,000',
        description: 'We are looking for a Full Stack Engineer to join our core team. You will build and scale sleek web portals, SaaS consoles, and high-performance APIs.',
        requirements: '3+ years experience with React, Node.js, and PostgreSQL.\nExperience with cloud platforms like Render or AWS.\nStrong communication and problem-solving skills.',
        responsibilities: 'Collaborate with designers to implement premium user interfaces.\nOptimize database queries and API response times.\nWrite clean, reusable, and tested code.',
      },
      {
        title: 'AI / Machine Learning Specialist',
        department: 'AI & Data Science Lab',
        type: 'Full-time',
        location: 'Virginia (US East) / Remote',
        salary: '$120,000 - $150,000',
        description: 'Join our AI Lab to build cognitive agent workflows, custom LLM fine-tunes, and advanced predictive data pipelines.',
        requirements: 'Strong background in Python, PyTorch, or TensorFlow.\nExperience fine-tuning Open Source LLMs (Llama, Mistral).\nExperience with vector databases.',
        responsibilities: 'Design and deploy custom neural network architectures.\nIntegrate agentic workflows into client SaaS platforms.\nWork closely with data engineers to optimize pipeline throughput.',
      },
      {
        title: 'Software Engineer Intern',
        department: 'Engineering',
        type: 'Internship',
        location: 'Remote',
        salary: '$25 - $35 / hour',
        description: 'Kickstart your engineering career by working alongside senior mentors on real production software.',
        requirements: 'Basic proficiency in Javascript, HTML, and CSS.\nFamiliarity with Git and relational databases.\nEager to learn and receive feedback.',
        responsibilities: 'Assist in building and testing new backend API endpoints.\nFix minor UI bugs and write unit tests.\nParticipate in daily standup and code reviews.',
      }
    ];

    for (const job of jobs) {
      await client.query(
        `INSERT INTO jobs (title, department, type, location, salary, description, requirements, responsibilities, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active')`,
        [job.title, job.department, job.type, job.location, job.salary, job.description, job.requirements, job.responsibilities]
      );
      console.log(`Inserted job: ${job.title}`);
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
};

seedJobs();
