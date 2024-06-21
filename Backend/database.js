require('dotenv').config();
const mysql = require('mysql');
const dbHost = process.env.DB_HOST;
const dbPort = parseInt(process.env.DB_PORT);
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;
const db = mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password:dbPassword,
    database:dbName
 })



 module.exports = {db};