require('dotenv').config();
const mysql = require('mysql');
const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USERNAME;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;

const db = mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName
  });



 module.exports = {db};