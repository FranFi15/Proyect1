
const ENV = process.env.EXPO_PUBLIC_ENV || 'staging';

const environments = {
  staging: {
    gymAppBackend: 'https://staiging-gym-app.onrender.com', 
    superAdminBackend: 'https://staiging-super-admin.onrender.com', 
  },
  prod: {
    gymAppBackend: 'https://gym-app-bnhx.onrender.com',
    superAdminBackend: 'https://superadmin-ixil.onrender.com',
  }
};

const config = environments[ENV];

console.log(`🚀 App corriendo en entorno: ${ENV}`);

export default config;