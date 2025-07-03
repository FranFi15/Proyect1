import React, { createContext, useState, useContext, useEffect } from 'react';

const GymContext = createContext();

export const GymProvider = ({ children }) => {
    const [gymIdentifier, setGymIdentifier] = useState(null); // ID del cliente, ej: 6858d81c...
    const [gymUrlIdentifier, setGymUrlIdentifier] = useState(null); // ID de la URL, ej: 'hola'
    const [gymName, setGymName] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const storedIdentifier = localStorage.getItem('gymIdentifier');
            const storedUrlIdentifier = localStorage.getItem('gymUrlIdentifier');
            const storedGymName = localStorage.getItem('gymName');
            if (storedIdentifier && storedUrlIdentifier) {
                setGymIdentifier(storedIdentifier);
                setGymUrlIdentifier(storedUrlIdentifier);
                setGymName(storedGymName);
            }
        } catch (error) {
            console.error("Error al leer datos del gym del localStorage", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const setGymInfo = (clientId, name, urlIdentifier) => {
        localStorage.setItem('gymIdentifier', clientId);
        localStorage.setItem('gymName', name);
        localStorage.setItem('gymUrlIdentifier', urlIdentifier);
        setGymIdentifier(clientId);
        setGymName(name);
        setGymUrlIdentifier(urlIdentifier);
    };

    const clearGymInfo = () => {
        localStorage.removeItem('gymIdentifier');
        localStorage.removeItem('gymName');
        localStorage.removeItem('gymUrlIdentifier');
        setGymIdentifier(null);
        setGymName(null);
        setGymUrlIdentifier(null);
    };

    const value = {
        gymIdentifier,
        gymUrlIdentifier,
        gymName,
        setGymInfo,
        clearGymInfo,
        loading,
    };

    return (
        <GymContext.Provider value={value}>
            {children}
        </GymContext.Provider>
    );
};

export const useGym = () => useContext(GymContext);
