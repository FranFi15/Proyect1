// gym-app-backend/utils/generateToken.js (Ejemplo)
import jwt from 'jsonwebtoken';

const generateToken = (id, roles, email, nombre) => { 
    return jwt.sign(
        { id, roles, email, nombre }, 
        process.env.JWT_SECRET,
        {
            expiresIn: '30d',
        }
    );
};

export default generateToken;