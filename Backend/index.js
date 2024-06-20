const express = require('express');
const cors =  require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const  jwt = require('jsonwebtoken');
const {score_data} = require('./score')
const {db} = require('./database')
const { NlpManager } = require("node-nlp");
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const salt = 10;
const app = express();

app.use(bodyParser.json());
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000"],
    methods: ["POST", "GET"],
    credentials: true
}));
app.use(cookieParser());

// Checking Database Connection
db.connect((err)=>{
    if(err){
        console.log(err)
    }else{
        console.log("Database Connected")
    }
 })

// Vercel
app.get("/", (req, res) => res.send("Express on Vercel"));  
// Verify user    


  app.listen(8081,() =>{
    console.log("Server is running on port: 8081")
 });  