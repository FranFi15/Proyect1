import mongoose from 'mongoose';

const storeItemSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    // Cached total stock across options (kept in sync on save / fulfillment)
    amount: { type: Number, required: true, min: 0, default: 0 },
    // [{ name, amount }] — Mixed keeps legacy string options readable
    options: { type: [mongoose.Schema.Types.Mixed], default: [] },
    imageUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true
});

const getStoreItemModel = (dbConnection) => {
    if (dbConnection.models.StoreItem) return dbConnection.models.StoreItem;
    return dbConnection.model('StoreItem', storeItemSchema);
};

export default getStoreItemModel;
