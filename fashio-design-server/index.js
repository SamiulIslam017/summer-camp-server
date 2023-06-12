const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SK);
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
// const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;
// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.azmaoyl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("summerCamp").collection("users");
    const coursesCollection = client.db("summerCamp").collection("courses");
    const bookingCollection = client.db("summerCamp").collection("booking");

    // jwt api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // verify admin or not
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      next();
    };

    // user collection for admin only
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    //users collection get for website
    app.get("/instructors", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // create user api to store user information
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/hidden/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });
    // check admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ role: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { role: user?.role === "admin" };
      res.send(result);
    });

    // check instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ role: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { role: user?.role === "instructor" };
      res.send(result);
    });

    // user collection admin handle
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

    // user collection instructor handle
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

    // delete user
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Courses collection related
    app.get("/courses/admin", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await coursesCollection
        .find()
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });
    //
    app.post("/courses", async (req, res) => {
      const course = req.body;
      const result = await coursesCollection.insertOne(course);
      res.send(result);
    });

    // single course find api
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coursesCollection.findOne(query);
      res.send(result);
    });

    // update single course update api
    app.patch("/courses/update/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedCourse = req.body;
      const updateDoc = {
        $set: {
          course_name: updatedCourse.course_name,
          total_seats: updatedCourse.total_seats,
          price: updatedCourse.price,
          image: updatedCourse.image,
        },
      };

      const result = await coursesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get single instructor all courses api
    app.get("/courses", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await coursesCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // update course status approved
    app.patch("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await coursesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // update course status denied
    app.patch("/courses/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const updateFeedback = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: updateFeedback.status,
          feedback: updateFeedback.feedback,
        },
      };
      const result = await coursesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get all courses for everyone
    app.get("/open", async (req, res) => {
      const result = await coursesCollection
        .find({ status: "approved" })
        .sort({ total_students: -1 })
        .toArray();
      res.send(result);
    });

    // booking collection related api

    app.post("/booking", async (req, res) => {
      const course = req.body;
      const result = await bookingCollection.insertOne(course);
      res.send(result);
    });

    app.get("/booking/payment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });
    app.get("/booking", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { user_email: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // payment api
    // app.post("/create-payment-intent", async (req, res) => {
    //   const { price } = req.body;
    //   const amount = price * 100;
    //   console.log(amount);
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount: amount,
    //     currency: "usd",
    //     payment_method_types: ["card"],
    //   });
    //   res.send({
    //     clientSecret: paymentIntent.client_secret,
    //   });
    // });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome to our server");
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
