import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true); 

    

    const [gymName, setGymName] = useState(null);
    const [gymLogo, setGymLogo] = useState(null);
    const [gymUrlIdentifier, setGymUrlIdentifier] = useState(null);

    useEffect(() => {

        const loadAuthData = async () => {
            setLoading(true); 

            try {
                const user = authService.getCurrentUser();
                if (user) {
                    setUserInfo(user);
                }

                const storedGymName = sessionStorage.getItem('gymName');
                const storedGymLogo = sessionStorage.getItem('gymLogo');
                const storedGymUrlIdentifier = sessionStorage.getItem('gymUrlIdentifier');

                if (storedGymName) setGymName(storedGymName);
                if (storedGymLogo) setGymLogo(storedGymLogo);
                if (storedGymUrlIdentifier) setGymUrlIdentifier(storedGymUrlIdentifier);

            } catch (e) {
                console.error("Error loading initial auth state:", e); // This is already good
            } finally {
                setLoading(false); 
                
            }
        };
        loadAuthData();
    }, []);

    const setGymContext = ({ clientId, gymName, logoUrl, gymUrlIdentifier }) => {
        // This is where clientId is primarily set for the api.js interceptor
        sessionStorage.setItem('clientId', clientId); 
        sessionStorage.setItem('gymName', gymName);
        sessionStorage.setItem('gymLogo', logoUrl || '');
        sessionStorage.setItem('gymUrlIdentifier', gymUrlIdentifier);

        setGymName(gymName);
        setGymLogo(logoUrl || '');
        setGymUrlIdentifier(gymUrlIdentifier);
    };

    const login = async (email, password) => {
        if (!gymUrlIdentifier) { // This check remains important for user experience
            throw new Error("No se ha identificado el gimnasio. Por favor, ingresa el código.");
        }
        
        // Call authService.login without gymUrlIdentifier here, as it's handled by api.js
        const data = await authService.login({ email, contraseña: password }); 
        setUserInfo(data);
        return data; 
    };

    const register = async (userData) => { // Added `register` function to AuthContext
        if (!gymUrlIdentifier) {
            throw new Error("No se ha identificado el gimnasio para el registro.");
        }
        // Call authService.registerAdmin without gymUrlIdentifier here
        const newUserData = await authService.registerAdmin(userData);
        setUserInfo(newUserData);
        return newUserData;
    };

    const logout = async () => {
        authService.logout();
        sessionStorage.clear(); 
        setUserInfo(null);
        setGymName(null);
        setGymLogo(null);
        setGymUrlIdentifier(null);
    };

    const value = { 
        userInfo, 
        loading, 
        login, 
        logout,
        register, // Expose register function
        gymName,
        gymLogo,
        gymUrlIdentifier,
        setGymContext
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);