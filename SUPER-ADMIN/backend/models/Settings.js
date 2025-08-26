import mongoose from 'mongoose';
const { Schema } = mongoose;

// Este Schema define la estructura para guardar los precios universales.
// Solo existirá un único documento de este tipo en toda la base de datos.
const settingsSchema = new Schema({
  pricePerClient: {
    type: Number,
    required: true,
    default: 0, // Precio por defecto para gimnasios
  },
  restaurantPrice: {
    type: Number,
    required: true,
    default: 0, // Precio por defecto para restaurantes
  }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;