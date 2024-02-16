// server.js

// Import necessary modules
const express = require("express");
const dotenv = require("dotenv");
const next = require("next");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");

// Check if the environment is in development
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Load environment variables
dotenv.config({ path: "./config/config.env" });

// Define the user schema
const userSchema = new mongoose.Schema({
  to: {
    type: String,
    required: [true, "Bhai kisko send kar rha hai wo tho likh"],
  },
  email: {
    type: String,
    required: [true, "Please enter your email"],
  },
  message: {
    type: String,
    required: [true, "Please enter your message"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  from: {
    type: String,
    required: [true, "Please enter your name"],
  },
});

// Create a model for the Proposal
const ProposalModel = mongoose.model("Proposal", userSchema);

// Error handling middleware
class ErrorHandler extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const errorMiddleware = (err, req, res, next) => {
  console.error("Error Middleware:", err);

  // Handle different error scenarios
  if (err.message.includes("Resource not found")) {
    return res.status(400).json({
      success: false,
      message: `Resource not found. Invalid ${err.path}`,
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: `Duplicate ${Object.keys(err.keyValue)} Entered`,
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Json Web Token is invalid, Try again!",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Json Web Token is expired, Try again!",
    });
  }

  if (err.name === "ValidationError") {
    const errors = {};

    // Extract and organize validation errors
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });

    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors,
    });
  }

  err.message = err.message || "Internal Server Error";
  err.statusCode = err.statusCode || 500;

  return res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};

// Database connection setup
const dbConnection = async () => {
  console.log("MongoDB URI:", process.env.MONGO_URI);
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "Valentine_day",
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
};

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  host: "smtp.forwardemail.net",
  port: 465,
  secure: true,
  service: "gmail",
  auth: {
    user: "shivamshibu2003@gmail.com",
    pass: "xxeijsmpaezrggad",
  },
});

// Controller to handle sending messages
const message = async (req, res, next) => {
  console.log('Received POST request at /api/v1/Proposal/m');
  const { to, email, from, message } = req.body;

  if (!to || !email || !from || !message) {
    return res.status(400).json({
      success: false,
      message: "Please fill all fields",
    });
  }

  try {
    // Create a new ProposalModel instance
    const newPurpose = await ProposalModel.create({
      to,
      email,
      from,
      message,
    });

    // After successfully creating the proposal, send the email
    const mailOptions = {
      from: from,
      to: email,
      subject: "A Heartfelt Confession: Your Admirer Has a Message for You",
      text: `   
        A Very Warm Valentine's Day,
        On this day of love and affection, ${from}  want to take a moment to express just how much you mean to them. Kindly Read their message
        Message: ${message}. .............
        Take a moment to see this beautiful message for you. https://gleaming-seahorse-86d78b.netlify.app/${to}`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);

    // Respond with success message and the created purpose
    res.status(201).json({
      success: true,
      message: "Your message has been sent",
      Purpose_by: newPurpose,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: error.message,
    });
  }
};


// Controller to get all proposals
const getAllProposal = async (req, res, next) => {
    console.log('Received GET request at /api/v1/Proposal/all');
  try {
    const allPurpose = await ProposalModel.countDocuments();
    const tops = await ProposalModel.find({})
    .populate('from') 
      .sort({ createdAt: -1 })
      .limit(3);
    console.log(tops);
    res.status(200).json({
      success: true,
      message: "All proposal",
      count: allPurpose,
      Proposal: tops.map((proposal) => proposal.from),
    });
  } catch (error) {
    next(error);
  }
};

// Async error handling utility
const catchAsyncError = (fun) => {
  return (req, res, next) => {
    Promise.resolve(fun(req, res, next).catch(next));
  };
};

// Setup Express server
dbConnection();

app.prepare().then(() => {
  const server = express();

  server.use(cors({
    origin: [process.env.FRONTEND_URL],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }));

  server.use(cookieParser());
  server.use(bodyParser.json());
  server.use(bodyParser.urlencoded({ extended: true }));

  server.post("/api/v1/Proposal/m", message);
  server.get("/api/v1/Proposal/all", getAllProposal);

  server.use("/api/v1/Proposal", (req, res) => {
    return app.render(req, res, "/api/v1/Proposal", req.query);
  });

  server.get("*", (req, res) => {
    return handle(req, res);
  });

  server.listen(process.env.PORT , (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${process.env.PORT}`);
  });
});
