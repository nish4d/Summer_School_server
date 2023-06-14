require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// jwt verification
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yngd7m6.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbConnect = async () => {
  try {
    client.connect();
    console.log("Database Connected Successfully✅");

  } catch (error) {
    console.log(error.name, error.message);
  }
}
dbConnect()



    const classCollection = client.db("summerSchool").collection("class");
    const instructorCollection = client
      .db("summerSchool")
      .collection("instructor");
    const usersCollection = client.db("summerSchool").collection("users");
    const paymentCollection = client.db("summerSchool").collection("payment");
    const selectedCollection = client.db("summerSchool").collection("selected");

    app.get("/", (req, res) => {
      res.send("Summer camp running....!");
    });

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Warning: use verifyJWT before using verifyAdmin
     const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    // user related api
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    ////////////////////////////////////////////////////
    // class related api
    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });
    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    });
    

    app.post("/classes", async (req, res) => {
      const cursor = req.body;
      const result = await classCollection.insertOne(cursor);
      res.send(result);
    });

    app.get("/instructorClasses/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const query = { instructorEmail: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/classStatus/:status", async (req, res) => {
      const status = req.params.status;
      // console.log(email);
      const query = { status: status };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/enroll", async (req, res) => {
      const result = await classCollection.find().sort({ enrolled:-1 }).toArray();
      res.send(result);
    });

    app.patch("/classesUpdate/:id", async (req, res) => {
      const id = req.params.id;
      const cursor = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          className: cursor.className,
          price: cursor.price,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // approved classes
    app.patch("/classes/approved/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Deny classes
    app.patch("/classes/deny/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "deny",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // feedback classes
    app.patch("/classes/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const query = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: query,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    ///////////////////////////////////

    // instructor related api
    app.get("/instructor", async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });

    app.post("/instructor", async (req, res) => {
      const cursor = req.body;
      const result = await instructorCollection.insertOne(cursor);
      res.send(result);
    });

    // app.delete("/instructor/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await instructorCollection.deleteOne(query);
    //   res.send(result);
    // });

    //////////////////////////////////////////////





    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    // payment related api
    app.post('/payments',  async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const result = await classCollection.findOneAndUpdate(
        { _id: new ObjectId(payment.classId) },
        { $inc: { availableSeats: -1, enrolled: 1 } },
        { returnOriginal: false }
      );
        res.send({result,insertResult});
    })

    app.get('/payments/:email', async (req, res)=>{
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).sort({date: -1}).toArray();
      res.send(result)
    })



    // enrolled
    app.get('/enrolled/:email', async (req, res)=>{
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result)
    })


    

    /////////////////////////

    // selected class
    app.post('/selectedClassData', async (req, res) => {
      const user = req.body;
      const result = await selectedCollection.insertOne(user);
      res.send(result);
    })
    app.get('/selectedClass/:email', async (req, res) => {
      const email = req.params.email;
      const query = {userEmail: email};
      const result = await selectedCollection.find(query).toArray()
      res.send(result);
    })
    app.delete('/deletedClass/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await selectedCollection.deleteOne(query);
      res.send(result)
    })

    app.get("/selectedClasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.findOne(query);
      res.send(result);
    });


    //////////////////////////






app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
