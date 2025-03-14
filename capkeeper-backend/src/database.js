import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Database config (production)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 25060,
    ssl: {
        ca: fs.readFileSync(path.join(__dirname, '../certs/ca-certificate.crt')),
    }
}); 

/*
// Database config (development)
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_LOCAL_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_LOCAL_PORT || 3306,
});
*/

export const db = {
    connect: async () => {
        try {
            const connection = await pool.getConnection();
            console.log('Connected to the database');
            connection.release();
        } catch (err) {
            console.error('Error connecting to the database:', err);
        }
    },
    query: async (queryString, escapedValues) => {
        let connection;
        try {
            connection = await pool.getConnection();
            const [results, fields] = await connection.query(queryString, escapedValues);
            return { results, fields };
        } catch (err) {
            console.error('Error executing query:', err);
            throw err;
        } finally {
            if (connection) connection.release();
        }
    },
    end: async () => {
        try {
            await pool.end();
            console.log('Connection pool closed');
        } catch (err) {
            console.error('Error closing the connection pool:', err);
        }
    },
};