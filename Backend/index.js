const app = require('./app');
const config = require('./config/environment');

// Vercel
app.get("/", (req, res) => res.send("Express on Vercel")); 

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});