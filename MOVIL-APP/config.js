
const ENV = process.env.EXPO_PUBLIC_ENV || 'prod';

const environments = {
  staging: {
    gymAppBackend: 'https://staiging-gym-app.onrender.com/api', 
    superAdminBackend: 'https://staiging-super-admin.onrender.com/api/public', 
  },
  prod: {
    gymAppBackend: 'https://gym-app-bnhx.onrender.com/api',
    superAdminBackend: 'https://superadmin-ixil.onrender.com/api/public',
  }
};

const config = environments[ENV];



export default config;