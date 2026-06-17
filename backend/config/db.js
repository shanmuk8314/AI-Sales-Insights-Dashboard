const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log("MONGO URI:", process.env.MONGO_URI);

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 3000
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    global.dbConnected = true;
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    console.log("Database connection failed. Falling back to local JSON file-based database.");
    global.dbConnected = false;
  }
};

module.exports = connectDB;