import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURL = process.env.DATABASE_URI;
    
    if (!mongoURL) {
      throw new Error('DATABASE_URI environment variable is required');
    }

    await mongoose.connect(mongoURL);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
