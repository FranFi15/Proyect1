let sessionExpiredCallback = null;
let isEventBlocked = false;

export const registerSessionExpiredHandler = (callback) => {
    sessionExpiredCallback = callback;
};

export const triggerSessionExpired = () => {
    if (isEventBlocked) return;
    isEventBlocked = true;
    if (sessionExpiredCallback) {
        sessionExpiredCallback();
    }
    setTimeout(() => {
        isEventBlocked = false;
    }, 5000);
};