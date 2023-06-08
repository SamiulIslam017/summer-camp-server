const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
// const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Welcome to our server");
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
