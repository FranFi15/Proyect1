import admin from 'firebase-admin';

const initializeFirebaseAdmin = () => {
    // Lee las credenciales como un string desde la variable de entorno
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

    // Procede solo si la variable existe Y si Firebase no ha sido inicializado antes
    if (serviceAccountString && !admin.apps.length) {
        // Convierte el string de vuelta a un objeto JSON
        const serviceAccount = JSON.parse(serviceAccountString);

        // Llama a initializeApp DENTRO del bloque if
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin inicializado desde variable de entorno.');
        
    } else if (admin.apps.length) {
        console.log('Firebase Admin ya estaba inicializado.');
    } else {
        console.error('Variable de entorno FIREBASE_SERVICE_ACCOUNT no encontrada. La app no puede funcionar.');
    }
};

export default initializeFirebaseAdmin;