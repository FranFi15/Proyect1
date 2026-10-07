/**
 * Shared discount / cart pricing helpers for caja and client checkout.
 */

export const isDiscountValidNow = (discount, now = new Date()) => {
    if (!discount?.isActive) return false;
    if (discount.validFrom && new Date(discount.validFrom) > now) return false;
    if (discount.validTo && new Date(discount.validTo) < now) return false;
    return true;
};

export const computeDiscountAmount = (subtotal, { discount, discountPercent, discountAmount } = {}) => {
    const base = Math.max(0, Number(subtotal) || 0);
    if (discount && isDiscountValidNow(discount)) {
        if (discount.type === 'percent') {
            return Math.min(base, Math.round(base * (Number(discount.value) / 100) * 100) / 100);
        }
        return Math.min(base, Number(discount.value) || 0);
    }
    if (discountPercent != null && discountPercent !== '') {
        const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
        return Math.min(base, Math.round(base * (pct / 100) * 100) / 100);
    }
    if (discountAmount != null && discountAmount !== '') {
        return Math.min(base, Math.max(0, Number(discountAmount) || 0));
    }
    return 0;
};

export const cartSubtotal = (cart = []) =>
    cart.reduce((sum, entry) => {
        if (!entry?.pkg) return sum;
        const qty = Math.max(1, Number(entry.quantity) || 1);
        return sum + (Number(entry.pkg.price) || 0) * qty;
    }, 0);

/**
 * Resolve the effective catalog discount for a user.
 * Prefers Discount.assignedUsers membership; falls back to User.assignedDiscountId.
 */
export const resolveUserDiscount = async (DiscountModel, user) => {
    if (!user || !DiscountModel) return null;
    const userId = user._id || user.id;
    if (userId) {
        const linked = await DiscountModel.findOne({
            assignedUsers: userId,
            isActive: true,
        }).sort({ updatedAt: -1 });
        if (linked && isDiscountValidNow(linked)) return linked;
    }
    const discountId = user?.assignedDiscountId?._id || user?.assignedDiscountId;
    if (!discountId) return null;
    const discount = await DiscountModel.findById(discountId);
    if (!discount || !isDiscountValidNow(discount)) return null;
    return discount;
};

/**
 * Quote a package cart with optional user-assigned (or explicit) discount.
 */
export const quoteCart = (cart = [], { discount = null, discountPercent, discountAmount } = {}) => {
    const subtotal = Math.round(cartSubtotal(cart) * 100) / 100;
    const discountValue = computeDiscountAmount(subtotal, { discount, discountPercent, discountAmount });
    const total = Math.round((subtotal - discountValue) * 100) / 100;
    return {
        subtotal,
        discountAmount: discountValue,
        total,
        discountId: discount?._id || null,
        discountName: discount?.name || null,
        discountType: discount?.type || null,
        discountValue: discount != null ? Number(discount.value) : null,
    };
};
