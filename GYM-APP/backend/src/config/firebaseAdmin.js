import admin from 'firebase-admin';
import { createRequire } from 'module';

// Necesario para importar un archivo JSON en módulos ES
const require = createRequire(import.meta.url);
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

let firebaseApp;

const initializeFirebaseAdmin = () => {
    if (!admin.apps.length) {
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK inicializado correctamente.');
    } else {
        firebaseApp = admin.app();
    }
    return firebaseApp;
};

export default initializeFirebaseAdmin;