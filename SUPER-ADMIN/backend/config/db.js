import mongoose from "mongoose";

const connectDB = async () => {
    try {
        
       const conn = await mongoose.connect(process.env.MONGO_URI_BASE);
        console.log("✅ Conectado a MongoDB");
    } catch (error) {
        console.error('❌ Error al conectar a MongoDB:', error.message);
        process.exit(1); 
    }
    }

export default connectDB;