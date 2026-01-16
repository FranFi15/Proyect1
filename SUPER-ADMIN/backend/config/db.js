import mongoose from "mongoose";

const connectDB = async () => {
    try {
        console.log("------------------------------------------------");
        console.log("🕵️ MISTERIO DE LA BASE DE DATOS");
        console.log("La variable MONGO_URI_BASE vale:", process.env.MONGO_URI_BASE);
        console.log("------------------------------------------------");
       const conn = await mongoose.connect(process.env.MONGO_URI_BASE);
        console.log("✅ Conectado a MongoDB");
    } catch (error) {
        console.error('❌ Error al conectar a MongoDB:', error.message);
        process.exit(1); 
    }
    }

export default connectDB;