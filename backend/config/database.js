import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Solo cargar .env en desarrollo
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Verificar que DATABASE_URL esté disponible
const DATABASE_URL = process.env.DATABASE_URL;
console.log('🔍 DATABASE_URL:', DATABASE_URL ? 'Configurada' : 'NO CONFIGURADA');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está configurada');
  console.error('Variables de entorno disponibles:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('NEON')));
  throw new Error('DATABASE_URL environment variable is required');
}

// Usar Neon serverless para mejor rendimiento
// Agregar configuración de timeout para evitar "fetch failed" en Railway
const sql = neon(DATABASE_URL, {
  fetchConnectionCache: true,
  arrayMode: false,
});

// Función auxiliar para reintentos con backoff exponencial
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⚠️ Intento ${attempt} falló, reintentando en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Crear un objeto compatible con las queries existentes
const pool = {
  query: async (text, params = []) => {
    try {
      // Usar timeout de 30 segundos para evitar cuelgues
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 30s')), 30000)
      );

      const result = await Promise.race([
        sql(text, params),
        timeoutPromise,
      ]);

      return {
        rows: result,
        rowCount: result.length,
      };
    } catch (error) {
      console.error('❌ Error en la consulta:', error.message);
      throw error;
    }
  },

  // Función auxiliar para conectar con reintentos
  connect: async () => {
    return retryWithBackoff(async () => {
      const result = await sql('SELECT NOW()');
      return result;
    });
  },
};

console.log('✅ Cliente Neon inicializado (conexión lazy-loaded)');

export default pool;
