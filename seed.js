import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isLocalhost = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'));
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false }
});

const seedJobs = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to database. Seeding jobs...');

    // 1. Delete specific mock jobs
    await client.query(`
      DELETE FROM jobs 
      WHERE description = 'VCUDCVUDUT' 
         OR (title = 'Full Stack Engineer' AND location LIKE '%Virginia%')
         OR (title = 'AI / Machine Learning Specialist' AND location LIKE '%Virginia%')
         OR (title = 'Software Engineer Intern' AND location = 'Remote' AND salary = '$25 - $35 / hour');
    `);

    // 2. Check if the new realistic jobs are already present
    const checkResult = await client.query(`
      SELECT COUNT(*) FROM jobs WHERE title IN (
        'AI/ML Integration Specialist',
        'Senior Frontend Engineer',
        'Software Engineer (Node.js/PostgreSQL)',
        'UI/UX Design Intern'
      );
    `);
    const count = parseInt(checkResult.rows[0].count, 10);
    
    if (count > 0) {
      console.log(`The database already has ${count} matching job listings. Skipping seeding.`);
      return;
    }

    const jobs = [
      {
        title: 'AI/ML Integration Specialist',
        department: 'AI Engineering',
        type: 'Full-time',
        location: 'Bangalore (On-site / Hybrid)',
        salary: '₹12L - ₹18L / annum',
        description: 'We are looking for an AI/ML Integration Specialist to design, build, and deploy agentic AI features, retrieval pipelines, and vector database structures. You will work on cutting-edge neural interfaces and coordinate with our frontend team to implement premium cognitive interactions.',
        requirements: '2+ years of experience with Python, PyTorch, and generative AI APIs (OpenAI, Gemini).\nExperience with LangChain, LangGraph, or custom multi-agent orchestration frameworks.\nStrong hands-on experience with vector databases (Pinecone, PGVector, ChromaDB).\nUnderstanding of LLM fine-tuning and retrieval-augmented generation (RAG) pipelines.',
        responsibilities: 'Build and optimize backend vector pipeline workflows for agent operations.\nIntegrate agentic workflows into our client-facing SaaS platforms and applications.\nResearch, deploy, and benchmark foundational models for niche industry use-cases.\nOptimize database queries and AI agent latency.'
      },
      {
        title: 'Senior Frontend Engineer',
        department: 'Engineering',
        type: 'Full-time',
        location: 'Bangalore (On-site / Hybrid)',
        salary: '₹10L - ₹15L / annum',
        description: 'Join our engineering team to build premium, highly-interactive web portals, SaaS consoles, and fluid user experiences. You will lead the client-side engineering for our next-generation digital products.',
        requirements: '4+ years of professional software engineering experience.\nExpertise in React, Vite, CSS/SCSS, and modern client-side state management.\nStrong eye for typography, layout spacing, glassmorphism, and premium micro-interactions.\nExperience optimizing Core Web Vitals (LCP, INP, CLS) and responsive design.',
        responsibilities: 'Architect, build, and optimize high-fidelity, responsive user interfaces.\nCollaborate closely with UI/UX designers to translate Figma layouts into interactive realities.\nEstablish frontend coding standards and maintain reusable component libraries.\nMentor junior developers and participate in code reviews.'
      },
      {
        title: 'Software Engineer (Node.js/PostgreSQL)',
        department: 'Engineering',
        type: 'Full-time',
        location: 'Bangalore (On-site / Hybrid)',
        salary: '₹8L - ₹12L / annum',
        description: 'We are seeking a Backend-focused Software Engineer to design, implement, and maintain scalable APIs, server architectures, and database tables.',
        requirements: '3+ years experience with Node.js, Express, and PostgreSQL.\nDeep understanding of RESTful API design, database schemas, and SQL query optimization.\nFamiliarity with secure authentication protocols (JWT, OAuth) and CORS configurations.\nExperience with deployment pipelines and cloud infrastructure (Render, AWS).',
        responsibilities: 'Design robust database schemas and write efficient SQL queries.\nDevelop, test, and document RESTful backend APIs.\nEnsure deep infrastructure security, data integrity, and error handling.\nCollaborate with frontend engineers to integrate user-facing features.'
      },
      {
        title: 'UI/UX Design Intern',
        department: 'Design',
        type: 'Internship',
        location: 'Bangalore / Hybrid',
        salary: '₹25,000 - ₹35,000 / month',
        description: 'Kickstart your career in product design by working alongside senior mentors and developers to craft stunning, user-centric visual experiences.',
        requirements: 'Proficiency in Figma and standard design prototyping tools.\nA solid understanding of visual hierarchy, typography, colors, and layout spacing.\nEager to learn, receive feedback, and collaborate in a fast-paced environment.\nA portfolio showcasing clean web or mobile UI/UX design concepts.',
        responsibilities: 'Design intuitive, premium user interfaces, wireframes, and prototypes.\nAssist in establishing and maintaining our agency\'s design tokens and styling systems.\nCollaborate with engineers to ensure design fidelity during frontend development.'
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
