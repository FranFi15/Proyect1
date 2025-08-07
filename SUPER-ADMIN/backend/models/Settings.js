import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
    // Usamos un ID fijo para que siempre haya un solo documento de configuración
    singleton: { type: String, default: 'main_settings', unique: true }, 
    basePrice: { type: Number, required: true, default: 40000 },
    pricePerBlock: { type: Number, required: true, default: 15000 },
});

const Settings = mongoose.model('Settings', SettingsSchema);
export default Settings;