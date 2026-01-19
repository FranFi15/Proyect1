// gym-app-backend/utils/generateToken.js (Ejemplo)
import jwt from 'jsonwebtoken';

const generateToken = (id, gymId, roles, email, nombre) => { 
    return jwt.sign(
        { id, gymId, roles, email, nombre }, 
        process.env.JWT_SECRET,
        {
            expiresIn: '1y',
        }
    );
};

export default generateToken;