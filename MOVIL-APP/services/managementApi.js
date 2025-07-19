import apiClient from './apiClient';

// --- Transacciones y Balance ---
export const createTransaction = (data) => apiClient.post('/transactions', data);
export const getUserTransactions = (userId) => apiClient.get(`/transactions/user/${userId}`);
export const getMyBalance = () => apiClient.get('/transactions/my-balance');

// --- Planes de Entrenamiento ---
export const createTrainingPlan = (data) => apiClient.post('/plans', data);
export const getTrainingPlansForUser = (userId) => apiClient.get(`/plans/user/${userId}`);
export const updateTrainingPlan = (planId, data) => apiClient.put(`/plans/${planId}`, data);
export const getMyVisiblePlan = () => apiClient.get('/plans/my-plan');