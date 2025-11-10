import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// Solo cargar .env en desarrollo
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Verificar que DATABASE_URL esté disponible
let DATABASE_URL = process.env.DATABASE_URL;
console.log('🔍 DATABASE_URL recibida:', DATABASE_URL ? 'SÍ' : 'NO');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está configurada');
  console.error('Variables de entorno disponibles:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('NEON')));
  throw new Error('DATABASE_URL environment variable is required');
}

// Limpiar URL: remover channel_binding y otros parámetros problemáticos
try {
  const url = new URL(DATABASE_URL);

  // Remover parámetros que causan problemas en Railway
  url.searchParams.delete('channel_binding');
  url.searchParams.delete('application_name');

  DATABASE_URL = url.toString();
  console.log('🔧 URL limpiada: parámetros removidos');
  console.log('🔍 URL limpia comienza con:', DATABASE_URL.substring(0, 60) + '...');
} catch (err) {
  console.warn('⚠️ No se pudo parsear URL, usando como está:', err.message);
}

// Crear pool PostgreSQL estándar (más compatible que Neon client)
console.log('🚀 Iniciando pool PostgreSQL...');
const pool = new Pool({
  connectionString: DATABASE_URL,
  // Configuración óptima para Railway
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
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

// Envolver el pool para agregar reintentos y timeouts
const wrappedPool = {
  query: async (text, params = []) => {
    try {
      return await pool.query(text, params);
    } catch (error) {
      console.error('❌ Error en la consulta:', error.message);
      throw error;
    }
  },

  // Función auxiliar para conectar con reintentos
  connect: async () => {
    return retryWithBackoff(async () => {
      const result = await pool.query('SELECT NOW()');
      return result.rows;
    });
  },

  // Método para cerrar pool
  end: async () => {
    return pool.end();
  },
};

// Event listeners para debugging
pool.on('error', (err) => {
  console.error('❌ Error inesperado en pool PostgreSQL:', err);
});

pool.on('connect', () => {
  console.log('✅ Nueva conexión PostgreSQL establecida');
});

console.log('✅ Pool PostgreSQL inicializado (usando pg driver)');

export default wrappedPool;
