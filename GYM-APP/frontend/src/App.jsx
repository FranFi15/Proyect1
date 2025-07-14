// GYM-APP/frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/common/PrivateRoute';

// Import pages
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import GymIdentifierPage from './pages/Auth/GymIdentifierPage'; // Import the new page
import DashboardPage from './pages/DashboardPage';
// import other pages as needed

import './App.css';

function App() {
    return (
        <Router>
            <AuthProvider>
                    <div className="App">
                        <Routes>
                            {/* New root route for gym identification */}
                            <Route path="/" element={<GymIdentifierPage />} />

                            {/* Nested routes for login and register under a gym identifier */}
                            <Route path="/gym/:gymIdentifier" >
                                <Route path="login" element={<LoginPage />} />
                                <Route path="register" element={<RegisterPage />} />
                                <Route element={<PrivateRoute />}>             
                                <Route path="dashboard" element={<DashboardPage />}/>
                                </Route>
                
                        </Route>
                        </Routes>
                    </div>
            </AuthProvider>
        </Router>
    );
}

export default App;