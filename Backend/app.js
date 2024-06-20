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

 
// Verify user    
const verifyUser = (req, res,next)=>{
    const token = req.cookies.token;
    if(!token){
        return res.json({Error: "Your are not authenticated"});
    }else{
        jwt.verify(token,"jwt-secret-key",(err,decode)=>{
            if(err){
                return res.json({Error: "Token Error"});
            }else{
                req.id = decode.id;
                req.username = decode.username;
                next();
            }
        })
    }
}

app.get('/verify',verifyUser,(req, res)=>{
    return res.json({Status:"Success",username:req.username,id:req.id});
})

// Login and Sign up 
app.post('/signup',(req, res)=>{
    const sql = "INSERT INTO users(`username`,`email`,`age`,`gender`,`password`) VALUES (?)";
    bcrypt.hash(req.body.password.toString(),salt,(err,hash)=>{
        if(err) return res.json({Error: "Error for hashing password"});
        const values = [
            req.body.username,
            req.body.email,
            req.body.age,
            req.body.gender,
            hash
        ]
        db.query(sql, [values], (err,result)=>{
            if(err) return res.json({Error: "Inserting data Error in server"});
            return res.json({Status : "Success"})
        })
    })
})  
    app.post('/login',(req, res)=>{
        const sql = 'SELECT * FROM users WHERE email = ?';
        db.query(sql, [req.body.email], (err,data) =>{
            if(err) return res.json({Error: "Login error in server"});
            if(data.length > 0) {
                bcrypt.compare(req.body.password.toString(), data[0].password,(err, response)=>{
                    if(err) return res.json({Error: "password compare error"});
                    if(response){
                        const id = data[0].id;
                        const username = data[0].username
                        const token = jwt.sign({id,username},"jwt-secret-key",{expiresIn: '1d'});
                        res.cookie('token',token,{ httpOnly: true });
                        return res.json({Status : "Success"})
                    }else{
                        return res.json({Error : "Password not matched"})
                    }
                })
            }else{
                return res.json({Error: "No email existed"});
            }
        })
    })

// Objects
app.get('/object/:id', (req, res) => {
  const id = req.params.id;
  const sql = "SELECT * FROM words WHERE id = ?";
  db.query(sql, [id], (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    const result = rows.map((row) => ({
      id: row.id,
      word: row.word
    }));
    res.json(result[0]);
  });
});

// Practice-Section
app.post('/practiceSession-score', (req, res) => {
  const { values, word_id, word, player_id, player_username, user_ans } = req.body;
  const stringValue = JSON.parse(JSON.stringify(values)).user_data;
  const score = score_data(stringValue);

  // Check if user_ans is an empty string
  if (user_ans.length === 0) {
    res.status(400).send('Error: user answer cannot be empty');
    return;
  }

  const sql = "INSERT INTO practice_score(`word_id`,`score`,`player_id`,`player_username`,`word`,`user_ans`) VALUES (?,?,?,?,?,?)";
  db.query(sql, [word_id, score, player_id, player_username, word, user_ans], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error inserting data');
    } else {
      const avgSql = "SELECT AVG(score) FROM practice_score WHERE player_id = player_id limit 10";
      db.query(avgSql, [score,player_id], (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).send('Error retrieving average score');
        } else {
          const averageScore = result[0]['AVG(score)'];
          res.json({ score, average_score: averageScore, message: 'Data inserted successfully' });
        }
      });
    }
  });
});

// Human Competition Session
app.post('/humanCompetition-score',(req, res)=>{
  const {values,word_id,word,player_id,player,competitor,user_ans} = req.body;
  const stringValue = JSON.parse(JSON.stringify(values)).user_data;
  const score = score_data(stringValue);
  // Check if user_ans is an empty string
  if (user_ans.length === 0) {
    res.status(400).send('Error: user answer cannot be empty');
    return;
  }
  const sql = "INSERT INTO players_scores(`word_id`,`word`,`user_ans`,`score`,`player_id`,`player`,`competitor`) VALUES (?,?,?,?,?,?,?)";
  db.query(sql, [word_id,word,user_ans,score, player_id, player,competitor], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error inserting data');
    } else {
      setTimeout(() => {
        const compSql = "UPDATE players_scores SET competitor_score =? WHERE player =?";
        db.query(compSql,[score,competitor],(err,result) =>{
          if (err) {
            console.error(err);
            res.status(500).send('Error inserting data');
          } else {
            setTimeout(() => {
              const fetchComSql = "SELECT competitor_score FROM players_scores WHERE player =? AND word = ?";
              db.query(fetchComSql,[player,word],(err,result) =>{
                if (err) {
                  console.error(err);
                  res.status(500).send('Error searching data');
                } else {
                  if (result.length > 0 && result[0].competitor_score!== null) {
                    const competitorScore = result[0].competitor_score;  
                    res.json({score, competitorScore, message: 'Data inserted successfully' });
                  } else {
                    res.json({score, message: 'No competitor score found' });
                  }
                }
              });
            }, 3000); // 3 seconds timeout for fetchComSql block
          }
        })
      }, 10000); // 10 seconds timeout for overall response
    }
  });
});

  


app.post('/join_competition', (req, res) => {
  const id = req.body.id;
  const lobby_id = 1;
  const sql = 'UPDATE users SET lobby_id =? WHERE id =? ';

  // Execute the SQL query
  db.query(sql, [lobby_id, id], (err, result) => {
    if (err) throw err;

    // Check if any rows were affected by the update
    if (result.affectedRows > 0) {
      res.send('Joined the competition successfully');
    }
  }); 
});
  app.post('/fetchCompetitors', (req, res) => {
    const lobby_id = 1;
    const username = req.body.username;
    function roundRobin(usernames) {
      const numPlayers = usernames.length;
      let schedule = [];
    
      if (numPlayers % 2 !== 0) {
        usernames.push("Bye"); 
      }
    
      const totalRounds = numPlayers - 1;
      const matchesPerRound = Math.floor(usernames.length / 2);
    
      for (let round = 0; round < totalRounds; round++) {
        const roundMatches = [];
        for (let match = 0; match < matchesPerRound; match++) {
          const home = usernames[match];
          const away = usernames[usernames.length - 1 - match];
    
          if (home !== "Bye" && away !== "Bye") {
            roundMatches.push({ players: [home, away] });
          }
        }
        schedule.push(roundMatches);
    
        const firstPlayer = usernames.shift();
        usernames.push(usernames.shift());
        usernames.unshift(firstPlayer);
      }
    
      if (numPlayers % 2 !== 0) {
        usernames.pop(); 
      }
    
      return schedule;
    }
    let usernames = [];
    
    const sql = "SELECT username FROM users WHERE lobby_id = ? ";

    db.query(sql, [lobby_id], (err, rows) => {
      if (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
      } else {
        rows.forEach(row => {
          usernames.push(row.username);
        });
        const matches = roundRobin(usernames);
        const user = username;
        const competitors = matches.flatMap(round => round)
          .filter(match => match.players.includes(user))
          .map(match => match.players.find(player => player !== user));
          res.send(competitors)
      }
    });
  });

// AI - Section
app.post('/aiCompetition-score', (req, res) => {
  const {values,responseData,word_id,word,player_id,player_username,user_ans,aiAns,competitor} = req.body;
  const stringValue = JSON.parse(JSON.stringify(values)).user_data;
  const score = score_data(stringValue);
  const aiScore = score_data(responseData);
  if (user_ans.length === 0) {
    res.status(400).send('Error: user answer cannot be empty');
    return;
  }
  const sql = "INSERT INTO AICompetition_score(`word_id`,`word`,`user_ans`,`score`,`player_id`,`player_username`,`aiScore`,`competitor`,`aiAns`) VALUES (?,?,?,?,?,?,?,?,?)";
  db.query(sql, [word_id, word, user_ans, score, player_id, player_username, aiScore, competitor, aiAns], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error inserting data');
    } else {
      res.json({ score, aiScore, message: 'Data inserted successfully' });
    }
  });
});

const manager = new NlpManager(({ languages: ["en"]}));
  
  // Add documents
  manager.addDocument('en','Towel','explainTowel')
  manager.addDocument('en','Vacuum Cleaner','explainVacuumCleaner')
  manager.addDocument('en','Oven','explainOven')
  manager.addDocument('en','Tablet','explainTablet')
  manager.addDocument('en','Printer','explainPrinter')
  manager.addDocument('en','Sofa','explainSofa')
  manager.addDocument('en','Mirror','explainMirror')
  manager.addDocument('en','Blender','explainBlender') //
  manager.addDocument('en','Computer Mouse','explainMouse')
  manager.addDocument('en','Helmet','explainHelmet')
  manager.addDocument('en','Remote Control','explainRemoteControl')
  manager.addDocument('en','Screwdriver','explainScrewdriver')
  manager.addDocument('en','Fan','explainFan')
  manager.addDocument('en','Candle','explainCandle')
  manager.addDocument('en','Bed','explainBed')
  manager.addDocument('en','Stapler','explainStapler')
  manager.addDocument('en','Soap','explainSoap')
  manager.addDocument('en','Calculator','explainCalculator')
  manager.addDocument('en','Bicycle Helmet','explainBicycleHelmet')
  manager.addDocument('en','Skateboard','explainSkateboard')
  
  
  // Add answers
  manager.addAnswer('en','explainTowel',`Towels are an essential household item, often overlooked but indispensable in daily life. These simple pieces of fabric serve a multitude of purposes beyond just drying off after a shower. From wiping spills to providing a barrier between surfaces and users during exercise, towels are versatile tools. In the realm of personal hygiene, they promote cleanliness and comfort, aiding in maintaining good health. Moreover, towels are symbols of hospitality, found in hotels and spas worldwide, offering a touch of luxury and relaxation. Their significance extends beyond practicality; they can evoke memories of vacations, childhood, or cherished moments. Despite their humble nature, towels play a significant role in our lives, demonstrating the beauty in simplicity and the importance of everyday objects.`);
  manager.addAnswer('en','explainVacuumCleaner',`The vacuum cleaner stands as a cornerstone of modern household cleaning, revolutionizing the way we maintain our living spaces. This ingenious device utilizes suction power to efficiently remove dirt, dust, and debris from floors and carpets, ensuring a hygienic environment. With various models catering to different needs, vacuum cleaners offer versatility and convenience, from compact handheld versions to powerful upright designs. Beyond mere functionality, they represent a commitment to cleanliness and well-being, eliminating allergens and pollutants that can compromise indoor air quality. Moreover, the vacuum cleaner symbolizes technological advancement and innovation in the realm of home appliances, constantly evolving to meet the demands of modern life. As an indispensable tool in household chores, it streamlines cleaning tasks, saving time and effort while promoting a healthier living environment for all.`)
  manager.addAnswer('en','explainOven',`The oven stands as a cornerstone of culinary prowess, transforming raw ingredients into delectable dishes through the power of heat. This versatile appliance has been a staple in kitchens for centuries, evolving from humble hearths to modern marvels of technology. Whether it's baking, roasting, grilling, or broiling, the oven offers endless possibilities for culinary creativity. Its ability to maintain precise temperatures ensures consistent results, making it indispensable for both amateur cooks and professional chefs alike. Beyond its practical utility, the oven embodies tradition and culture, bringing families together over shared meals and special occasions. In today's fast-paced world, it facilitates convenience without sacrificing quality, allowing for quick and effortless meal preparation. From classic comfort foods to gourmet delights, the oven remains an essential tool for nourishment, enjoyment, and culinary exploration.`)
  manager.addAnswer('en','explainTablet',`Tablets have emerged as revolutionary devices, seamlessly blending the functionalities of smartphones and laptops into a portable and versatile form factor. These sleek, touchscreen devices have transformed the way we consume media, access information, and communicate on the go. With their compact design and intuitive interfaces, tablets offer convenience and mobility without compromising on performance. From browsing the internet to watching videos, reading e-books, and playing games, they cater to a wide range of entertainment and productivity needs. Moreover, tablets have found applications across various sectors, including education, healthcare, and business, enhancing efficiency and accessibility. As technology continues to advance, tablets evolve with it, incorporating innovative features and capabilities to stay at the forefront of digital innovation. With their adaptability and versatility, tablets have become indispensable tools for modern living, empowering users to stay connected, informed, and productive wherever they go.`)
  manager.addAnswer('en','explainPrinter',`Printers are essential tools in both professional and personal settings, facilitating the conversion of digital documents into tangible, physical copies. From offices to homes, these devices play a crucial role in tasks ranging from printing reports and presentations to family photos and school assignments. With advancements in technology, printers have evolved to offer a wide array of features, including high-resolution printing, wireless connectivity, and multifunctionality, combining printing, scanning, and copying capabilities into a single device. Moreover, printers come in various sizes and designs to suit different needs and spaces, from compact desktop models to large-format printers for specialized applications. As society becomes increasingly digital, printers remain relevant by bridging the gap between the virtual and physical worlds, providing a means to preserve, share, and distribute information in tangible form. In essence, printers serve as indispensable tools for communication, creativity, and documentation in today's digital age.`)
  manager.addAnswer('en','explainSofa',`Sofas are more than just pieces of furniture; they are symbols of comfort, relaxation, and socialization within the home. These upholstered seats have been a staple in living spaces for centuries, providing a cozy haven for individuals and families alike. Whether it's lounging with a book, gathering with loved ones for movie nights, or hosting guests for conversations, the sofa serves as a central hub of domestic life. With a myriad of designs, styles, and materials available, sofas cater to diverse tastes and preferences, from sleek modern aesthetics to classic and timeless designs. Beyond their functional utility, sofas contribute to the ambiance and character of a room, reflecting the personality and lifestyle of their owners. As a focal point of living rooms and lounges, sofas embody warmth, hospitality, and relaxation, making them indispensable pieces of home furnishing.`)
  manager.addAnswer('en','explainMirror',`Mirrors hold a unique place in human civilization, serving as portals to self-reflection and introspection. These reflective surfaces not only provide a means to assess one's appearance but also offer deeper insights into identity and perception. From ancient polished metals to modern glass mirrors, they have been integral to cultural rituals, superstitions, and artistic expression across civilizations. Mirrors play a crucial role in grooming routines, aiding in personal presentation and self-care. Beyond vanity, they amplify light and space, enhancing the ambiance and visual appeal of interiors. Moreover, mirrors have symbolic significance, representing truth, self-awareness, and the duality of existence in various spiritual and philosophical traditions. In a world inundated with digital images and screens, mirrors remain tangible reminders of our physical presence and reflection, inviting us to contemplate our inner and outer selves in a tangible, introspective way.`)
  manager.addAnswer('en','explainBlender',`The blender stands as a versatile and indispensable appliance in modern kitchens, revolutionizing the way we prepare food and beverages. With its powerful motor and sharp blades, the blender effortlessly transforms ingredients into smooth purees, sauces, soups, and beverages. From nutritious smoothies to creamy sauces and refreshing cocktails, it offers endless possibilities for culinary creativity. Moreover, blenders streamline meal preparation, saving time and effort in chopping, mixing, and blending ingredients. With advancements in technology, blenders now come in various shapes, sizes, and functionalities to cater to diverse culinary needs and preferences. Whether it's a compact personal blender for individual servings or a high-performance countertop blender for large batches, there's a blender for every kitchen. In essence, blenders embody convenience, efficiency, and versatility, empowering home cooks and culinary enthusiasts to explore new flavors and textures with ease.`)
  manager.addAnswer('en','explainMouse',`The mouse, a humble yet indispensable peripheral, has been a cornerstone of computer interaction since its inception. With its ergonomic design and intuitive functionality, the mouse provides users with precise control over the cursor, facilitating navigation, selection, and interaction with digital interfaces. From scrolling through web pages to clicking on icons and dragging files, the mouse enhances productivity and efficiency in computing tasks. With advancements in technology, mice have evolved to offer various features, including wireless connectivity, customizable buttons, and ergonomic designs to cater to different needs and preferences. Despite touchscreens and trackpads gaining popularity, the mouse remains a preferred choice for many due to its tactile feedback and precision. As a fundamental tool in human-computer interaction, the mouse continues to play a vital role in shaping the way we interact with technology, bridging the gap between humans and machines.`)
  manager.addAnswer('en','explainHelmet',`Helmets serve as crucial protective gear, safeguarding individuals from head injuries in various activities, particularly in sports and transportation. Whether it's cycling, motorcycling, or participating in contact sports, helmets provide a vital layer of protection against impacts and accidents. Constructed with durable materials and innovative designs, helmets are engineered to absorb and dissipate the force of impact, reducing the risk of traumatic brain injuries and concussions. Beyond physical safety, helmets also promote a culture of responsibility and risk management, encouraging users to prioritize their well-being while engaging in potentially hazardous activities. With advancements in technology, helmets now feature additional functionalities such as ventilation, aerodynamics, and integrated communication systems, enhancing both comfort and safety. As a symbol of safety consciousness and personal protection, helmets remind us of the importance of prioritizing safety in our pursuits, ensuring that we can enjoy our activities with peace of mind and confidence.`)
  manager.addAnswer('en','explainRemoteControl',`The remote control, a small yet mighty device, has revolutionized the way we interact with various electronic devices, from televisions to home entertainment systems. With just a press of a button, the remote control empowers users to command devices from a distance, effortlessly adjusting settings, changing channels, and navigating menus. Its convenience and simplicity have become integral to modern living, offering unparalleled comfort and control over our entertainment experiences. Moreover, remote controls have evolved alongside technology, incorporating advanced features such as voice commands, touchscreens, and programmable buttons to enhance usability and functionality. Beyond entertainment, remote controls find applications in various industries, including home automation, security systems, and medical devices, further streamlining tasks and improving efficiency. As a ubiquitous tool in our daily lives, the remote control epitomizes the intersection of technology and convenience, making our interactions with electronic devices seamless and intuitive.`)
  manager.addAnswer('en','explainScrewdriver',`The screwdriver, a simple yet indispensable tool, holds a pivotal role in various industries and household tasks. With its versatile design and functionality, the screwdriver facilitates the installation, assembly, and maintenance of countless objects held together by screws. From furniture assembly to automotive repairs, the screwdriver provides the torque needed to tighten or loosen screws with precision and ease. Available in different types and sizes, including flathead, Phillips, and Torx, screwdrivers cater to diverse screw designs and applications. Their ergonomic handles and durable shafts ensure comfortable and efficient use, making them essential components of any toolkit. Moreover, screwdrivers symbolize craftsmanship and ingenuity, embodying the spirit of precision engineering and practical problem-solving. As a timeless tool that transcends generations and industries, the screwdriver remains a cornerstone of construction, repair, and DIY projects, reflecting the timeless importance of simplicity and functionality in human innovation.`)
  manager.addAnswer('en','explainFan',`The fan, a ubiquitous household appliance, offers respite from heat and humidity while promoting air circulation and comfort. With its rotating blades powered by electric motors, the fan generates a gentle breeze that cools the surrounding area, making it a staple in homes, offices, and public spaces worldwide. From ceiling fans to pedestal fans and desk fans, there are various types suited to different needs and spaces. Beyond cooling, fans also aid in ventilation, reducing indoor pollutants and improving air quality. Moreover, fans are energy-efficient alternatives to air conditioning, offering cost-effective cooling solutions while reducing carbon emissions. As a symbol of comfort and relief, fans have transcended generations, providing solace during sweltering summers and fostering a sense of well-being and relaxation. In essence, the fan epitomizes the marriage of function and simplicity, enhancing our living spaces with its cooling embrace.`)
  manager.addAnswer('en','explainCandle',`Candles, with their soft glow and flickering flames, have captivated humanity for centuries, serving as sources of light, warmth, and ambiance. These simple yet versatile objects hold symbolic significance in various cultures and traditions, representing hope, spirituality, and celebration. From religious ceremonies to romantic dinners and cozy evenings at home, candles evoke feelings of intimacy and comfort. Beyond their aesthetic appeal, candles offer practical utility during power outages and outdoor adventures, providing illumination when electricity is unavailable. With a wide array of scents, colors, and designs available, candles cater to diverse preferences and occasions, enhancing the atmosphere and mood of any setting. Moreover, candles serve as reminders of simpler times and timeless rituals, connecting us to our shared human history and the enduring allure of candlelight in illuminating our lives with warmth and beauty.`)
  manager.addAnswer('en','explainBed',`Beds, the epitome of comfort and relaxation, are more than just pieces of furniture; they are sanctuaries of rest and rejuvenation. As the focal point of bedrooms, beds offer a haven for individuals to unwind and recharge after a long day. With their soft mattresses, cozy blankets, and plush pillows, they provide the perfect environment for restful sleep and peaceful dreams. Beyond their functional utility, beds symbolize security and intimacy, serving as shared spaces for couples and families to bond and connect. From platform beds to canopy beds and bunk beds, there are various designs to suit different preferences and lifestyles. As we spend a significant portion of our lives in bed, it becomes a cherished sanctuary where we retreat from the world, find solace, and embrace the comfort of home.`)
  manager.addAnswer('en','explainStapler',`The humble stapler, though often overlooked, holds a pivotal role in our daily lives, streamlining paperwork and organization with its simple yet effective design. With a squeeze of its handle, the stapler effortlessly binds sheets of paper together, offering a convenient solution for securing documents, reports, and assignments. Whether in offices, schools, or homes, staplers are indispensable tools for maintaining order and efficiency in various tasks. With different sizes and capacities available, staplers cater to diverse needs and preferences, from compact handheld models for light-duty use to heavy-duty staplers capable of binding thick stacks of paper. Moreover, staplers symbolize professionalism and attention to detail, ensuring that documents are presented neatly and professionally. As a timeless tool in the realm of stationery, the stapler embodies simplicity, reliability, and functionality, making it an essential component of any workspace or study area.`)
  manager.addAnswer('en','explainSoap',`Soap, a simple yet indispensable commodity, plays a vital role in personal hygiene and cleanliness. With its ability to remove dirt, oils, and germs from the skin, soap serves as a cornerstone of daily hygiene routines, promoting health and well-being. From handwashing to bathing, soap facilitates the removal of impurities and contaminants, reducing the risk of infections and illnesses. With various formulations available, including bar soap, liquid soap, and foam soap, there's a soap for every preference and need. Moreover, soap extends beyond its practical utility, carrying cultural and symbolic significance in rituals and ceremonies worldwide. As a symbol of purity and cleansing, soap reminds us of the importance of maintaining cleanliness and practicing good hygiene habits. In essence, soap embodies the timeless pursuit of cleanliness and health, empowering individuals to safeguard their well-being and that of others through simple yet effective means.`)
  manager.addAnswer('en','explainCalculator',`The calculator, a compact and versatile tool, has revolutionized the way we perform mathematical calculations, making complex computations accessible to people of all ages and backgrounds. With its intuitive interface and efficient processing power, the calculator simplifies arithmetic, algebra, and trigonometry, offering a convenient solution for solving equations and crunching numbers. From basic arithmetic operations to advanced scientific and financial calculations, calculators cater to diverse needs and disciplines, empowering students, professionals, and enthusiasts alike. Moreover, calculators serve as symbols of efficiency and precision, embodying the spirit of technological innovation and progress in mathematics and education. As indispensable tools in classrooms, offices, and everyday life, calculators streamline tasks, save time, and enhance accuracy, making them essential companions in the pursuit of knowledge and productivity in today's fast-paced world.`)
  manager.addAnswer('en','explainBicycleHelmet',`The bicycle helmet stands as a vital piece of safety equipment, protecting cyclists from head injuries and potentially saving lives. With its sturdy construction and impact-absorbing materials, the helmet provides a crucial layer of defense against the forces generated during falls or collisions. By shielding the head from trauma, it reduces the risk of severe injuries such as concussions or skull fractures, promoting safer cycling experiences for riders of all ages. Moreover, bicycle helmets serve as reminders of the importance of responsible behavior and risk mitigation while engaging in physical activities. As symbols of safety consciousness and personal protection, they encourage cyclists to prioritize their well-being and set an example for others on the road. In essence, bicycle helmets embody the intersection of technology, safety, and personal responsibility, ensuring that riders can enjoy the freedom and exhilaration of cycling with peace of mind and confidence.`)
  manager.addAnswer('en','explainSkateboard',`Skateboarding, a dynamic and exhilarating sport, has captured the hearts of enthusiasts worldwide with its blend of athleticism, creativity, and freedom. With its origins rooted in surfing and street culture, skateboarding has evolved into a diverse and vibrant subculture, encompassing various disciplines such as street skating, vert skating, and freestyle skating. Riders navigate urban landscapes with skill and finesse, performing tricks and maneuvers that push the boundaries of what's possible on four wheels and a wooden deck. Beyond its physical demands, skateboarding fosters camaraderie and self-expression, providing a platform for individuals to showcase their unique style and personality. As a symbol of counterculture and rebellion, skateboarding continues to inspire generations of riders to defy conventions and carve their own paths, both on and off the board. In essence, skateboarding represents the boundless pursuit of freedom, creativity, and self-discovery through the simple act of riding.`)
  // Train model
 
    
    // route and handler
    app.post('/bot', async (req, res) => {
      const { message } = req.body;
      let response = await manager.process('en', message);
      res.json(response.answer);
    });

  const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false, // use TLS
    auth: {
      username: 'wordgameexp@gmail.com',
      password: 'nrvcmxbbrpvwdzjy' // Replace with an environment variable or secure storage
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  // Route to handle forgot password requests
  app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
  
    // Query database for user with provided email
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], (err, results) => {
      if (err) {
        console.error('Error querying database:', err);
        return res.status(500).send({ message: 'Error querying database' });
      }
  
      const user = results[0];
      if (!user) {
        return res.status(404).send({ message: 'User not found' });
      }
  
      // Generate JWT token with user information
      const token = jwt.sign({ id: user.id, email: user.email }, 'your-secret-key', { expiresIn: '1d' });
  
      // Send password reset email
      const mailOptions = {
        from: 'wordgameexp@gmail.com',
        to: email,
        subject: 'Reset Password',
        text: `Please click on this link to reset your password: ${process.env.HOST}/reset-password?token=${token}`,
      };
  
      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error('Error sending email:', err);
          return res.status(500).send({ message: 'Error sending email' });
        }
  
        // Set a cookie with the token for further verification
        res.cookie('token', token, { httpOnly: true });
        res.send({ message: 'Email sent successfully' });
      });
    });
  });
// Logout
  app.get('/logout', (req,res) =>{
    res.clearCookie('token');
    return res.json({Status: "success"});
})


 
 module.exports = app;