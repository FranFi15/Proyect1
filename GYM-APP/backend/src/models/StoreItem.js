import mongoose from 'mongoose';

const storeItemSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0, default: 0 }, // stock
    options: { type: [String], default: [] }, // free-text options defined by admin
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true
});

const getStoreItemModel = (dbConnection) => {
    if (dbConnection.models.StoreItem) return dbConnection.models.StoreItem;
    return dbConnection.model('StoreItem', storeItemSchema);
};

export default getStoreItemModel;
