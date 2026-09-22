import axios from 'axios';

// This client is specifically for server-to-server communication
const superAdminApiClient = axios.create({
    baseURL: process.env.ADMIN_PANEL_API_URL, 
});

export const countActiveClients = async (UserModel) => {
    return UserModel.countDocuments({
        roles: 'cliente',
        isActive: { $ne: false },
    });
};

export const getClientSubscriptionInfo = async (clientId, apiSecretKey) => {
    try {
        const response = await superAdminApiClient.get(
            `/api/clients/internal/${clientId}/subscription-info`,
            { 
                headers: { 'x-internal-api-key': apiSecretKey } 
            }
        );
        return response.data; // Devuelve el objeto completo { clientLimit, clientCount }
    } catch (error) {
        console.error("Error getting subscription info:", error.response?.data?.message || error.message);
        throw new Error('No se pudo obtener la información del plan.');
    }
};

/**
 * Prefer live gym DB count when provided — the Super Admin counter can drift.
 */
export const checkClientLimit = async (clientId, internalApiKey, liveActiveCount = null) => {
    try {
        const response = await superAdminApiClient.get(
            `/api/clients/internal/${clientId}/subscription-info`, 
            { headers: { 'x-internal-api-key': internalApiKey } }
        );
        const { clientLimit, clientCount } = response.data;
        const count = typeof liveActiveCount === 'number' ? liveActiveCount : clientCount;
        return count < clientLimit;
    } catch (error) {
        console.error("Error checking client limit:", error.response?.data?.message || error.message);
        throw new Error('No se pudo verificar el límite del plan. Inténtalo de nuevo.');
    }
};

// Function to update the client count in the SUPER-ADMIN
export const updateClientCount = async (clientId, internalApiKey, action) => {
    try {
        await superAdminApiClient.put(
            `/api/clients/internal/${clientId}/client-count`, 
            { action },
            { headers: { 'x-internal-api-key': internalApiKey } }
        );
    } catch (error) {
        console.error(`CRITICAL: Failed to ${action} client count for ${clientId}:`, error.message);
    }
};

/** Recalculate active clients in the gym DB and push the absolute count to Super Admin. */
export const syncActiveClientCount = async (UserModel, clientId, internalApiKey) => {
    try {
        const count = await countActiveClients(UserModel);
        await superAdminApiClient.put(
            `/api/clients/internal/${clientId}/client-count`,
            { count },
            { headers: { 'x-internal-api-key': internalApiKey } }
        );
        return count;
    } catch (error) {
        console.error(`CRITICAL: Failed to sync client count for ${clientId}:`, error.message);
        return null;
    }
};

export const upgradeClientPlan = async (clientId, apiSecretKey) => {
    try {
        const response = await superAdminApiClient.put(
            `/api/clients/internal/${clientId}/upgrade-plan`,
            {},
            { 
                headers: { 'x-internal-api-key': apiSecretKey } 
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error upgrading client plan:", error.response?.data?.message || error.message);
        throw new Error('No se pudo ampliar el plan. Inténtalo de nuevo.');
    }
};
