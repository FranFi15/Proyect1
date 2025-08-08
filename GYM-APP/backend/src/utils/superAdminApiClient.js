import axios from 'axios';

// This client is specifically for server-to-server communication
const superAdminApiClient = axios.create({
    baseURL: process.env.ADMIN_PANEL_API_URL, // The URL of your SUPER-ADMIN backend
});

// Function to get the current client limit and count from the SUPER-ADMIN
export const checkClientLimit = async (clientId, internalApiKey) => {
    try {
        const response = await superAdminApiClient.get(
            `/api/clients/${clientId}/subscription-info`, // Usa el _id
            { headers: { 'x-internal-api-key': internalApiKey } }
        );
        const { clientLimit, clientCount } = response.data;
        return clientCount < clientLimit;
    } catch (error) {
        console.error("Error checking client limit:", error.response?.data?.message || error.message);
        // By default, if the check fails, we block the registration to be safe.
        throw new Error('No se pudo verificar el límite del plan. Inténtalo de nuevo.');
    }
};

// Function to update the client count in the SUPER-ADMIN
export const updateClientCount = async (clientId, internalApiKey, action) => {
    try {
        await superAdminApiClient.put(
            `/api/clients/${clientId}/client-count`,
            { action },
            { headers: { 'x-internal-api-key': internalApiKey } }
        );
    } catch (error) {
        // This error should be logged, as it indicates a desync in the count
        console.error(`CRITICAL: Failed to ${action} client count for ${clientId}:`, error.response?.data?.message || error.message);
        // We don't throw an error here because the user has already been created/deleted.
        // This is something the superadmin should monitor.
    }
};