import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/database.js';
import authRoutes from './routes/auth.js';
import excelRoutes from './routes/excel.js';
import cursosRoutes from './routes/cursos.js';
import plantelesRoutes from './routes/planteles.js';
import categoriasRoutes from './routes/categorias.js';
import cuotasRoutes from './routes/cuotas.js';
import pagosRoutes from './routes/pagos.js';
import inscripcionesRoutes from './routes/inscripciones.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos - Imágenes de cursos (solo si existen en monorepo)
const fotoCursoPath = path.join(__dirname, '..', 'frontend', 'public', 'foto_curso');
try {
  app.use('/foto_curso', express.static(fotoCursoPath));
} catch (err) {
  console.warn(`⚠️ No se pudo servir archivos estáticos de ${fotoCursoPath}`);
}

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/planteles', plantelesRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/cuotas', cuotasRoutes);
app.use('/api/payments', pagosRoutes);
app.use('/api/inscripciones', inscripcionesRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Verificar también que la BD está disponible
    await pool.query('SELECT NOW()');
    res.json({
      status: 'Backend funcionando correctamente',
      database: 'conectado',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'Backend en funcionamiento pero BD no disponible',
      database: 'desconectado',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
const iniciarServidor = async () => {
  try {
    // Probar conexión a BD con reintentos
    console.log('🔄 Intentando conectar a Neon con reintentos...');
    const resultado = await pool.connect();
    console.log('✅ Conexión a PostgreSQL exitosa:', resultado[0]);

    app.listen(PORT, () => {
      console.log(`✓ Servidor ejecutándose en puerto ${PORT}`);
      console.log(`✓ URL: http://localhost:${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('✗ Error al conectar a PostgreSQL:', error.message);
    console.error('ℹ️ El servidor continuará iniciando. La conexión se reintentará en la próxima query.');

    // En Railway, permitimos que el servidor inicie aunque la BD no esté disponible
    // Las queries se reintentan automáticamente
    app.listen(PORT, () => {
      console.log(`✓ Servidor ejecutándose en puerto ${PORT} (sin verificación de BD)`);
      console.log(`✓ URL: http://localhost:${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
    });
  }
};

iniciarServidor();

export default app;
