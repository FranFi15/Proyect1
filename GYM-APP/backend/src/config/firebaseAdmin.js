import admin from 'firebase-admin';

const initializeFirebaseAdmin = () => {
    
    const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    // Procede solo si la variable existe Y si Firebase no ha sido inicializado antes
    if (serviceAccountB64 && !admin.apps.length) {
        try {
            // Decodifica el string Base64 a un string JSON normal
            const serviceAccountString = Buffer.from(serviceAccountB64, 'base64').toString('utf8');
            
            // Convierte el string JSON de vuelta a un objeto
            const serviceAccount = JSON.parse(serviceAccountString);

            // Llama a initializeApp DENTRO del bloque if
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Firebase Admin inicializado correctamente desde variable de entorno.');

        } catch (error) {
            console.error('Error al parsear o inicializar Firebase Admin:', error);
            console.error('Asegúrate de que la variable FIREBASE_SERVICE_ACCOUNT_BASE64 sea un string Base64 válido del JSON de tu cuenta de servicio.');
        }

    } else if (admin.apps.length) {
        console.log('Firebase Admin ya estaba inicializado.');
    } else {
        console.error('Variable de entorno FIREBASE_SERVICE_ACCOUNT_BASE64 no encontrada. El backend no puede enviar notificaciones.');
    }
};

export default initializeFirebaseAdmin;