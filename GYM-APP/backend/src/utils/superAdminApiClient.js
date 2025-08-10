import axios from 'axios';

// This client is specifically for server-to-server communication
const superAdminApiClient = axios.create({
    baseURL: process.env.ADMIN_PANEL_API_URL, 
});

// Function to get the current client limit and count from the SUPER-ADMIN
export const checkClientLimit = async (clientId, internalApiKey) => {
    try {
        const response = await superAdminApiClient.get(
            `/api/clients/internal/${clientId}/subscription-info`, 
            { headers: { 'x-internal-api-key': internalApiKey } }
        );
        const { clientLimit, clientCount } = response.data;
        return clientCount < clientLimit;
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