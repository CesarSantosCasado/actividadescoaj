const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
  appId: "b6fac65a-32b5-445f-8831-d6f1be2b4433",
  accessKey: "V2-0kr7X-HiVCr-XkEZL-LE5qD-Rdl5Z-PDdhL-Ga3v8-B0j2w"
};

app.use(cors({
  origin: ['https://cesarsantoscasado.github.io', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));
app.use(express.json());

function buildRequest(tabla) {
  return {
    url: `https://api.appsheet.com/api/v2/apps/${CONFIG.appId}/tables/${tabla}/Action?applicationAccessKey=${CONFIG.accessKey}`,
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data: {
      "Action": "Find",
      "Properties": {
        "Locale": "es-MX",
        "Timezone": "Central Standard Time",
        "Selector": `Filter(${tabla}, true)`
      },
      "Rows": []
    }
  };
}

// ENDPOINT DE LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { alias, contrasena } = req.body;
    
    console.log('='.repeat(50));
    console.log(`[${new Date().toISOString()}] 🔐 Login intento: ${alias}`);
    const startTime = Date.now();

    console.log(`[${new Date().toISOString()}] 📡 Consultando AppSheet...`);
    const response = await axios({
      url: `https://api.appsheet.com/api/v2/apps/${CONFIG.appId}/tables/UsuariosLoginActividades/Action?applicationAccessKey=${CONFIG.accessKey}`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: {
        "Action": "Find",
        "Properties": {
          "Locale": "es-MX",
          "Timezone": "Central Standard Time",
          "Selector": `Filter(UsuariosLoginActividades, [Alias]="${alias}")`
        },
        "Rows": []
      },
      timeout: 30000  // 30 segundos
    });

    const responseTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ✅ AppSheet respondió en ${responseTime}ms`);

    const usuarios = response.data || [];
    console.log(`[${new Date().toISOString()}] 👥 Usuarios encontrados: ${usuarios.length}`);

    if (usuarios.length === 0) {
      console.log(`[${new Date().toISOString()}] ❌ Usuario NO encontrado: ${alias}`);
      console.log('='.repeat(50));
      return res.json({ success: false, message: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];
    console.log(`[${new Date().toISOString()}] 🔍 Validando contraseña...`);

    if (usuario.Contraseña === contrasena) {
      console.log(`[${new Date().toISOString()}] ✅ Login EXITOSO: ${alias} (${responseTime}ms)`);
      console.log('='.repeat(50));
      return res.json({
        success: true,
        usuario: {
          alias: usuario.Alias,
          nombre: usuario.Usuario || usuario.Nombre || usuario.Alias
        }
      });
    } else {
      console.log(`[${new Date().toISOString()}] ❌ Contraseña INCORRECTA: ${alias}`);
      console.log('='.repeat(50));
      return res.json({ success: false, message: 'Contraseña incorrecta' });
    }

  } catch (error) {
    console.error('='.repeat(50));
    console.error(`[${new Date().toISOString()}] ❌ ERROR en login:`, error.message);
    console.error('='.repeat(50));
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ success: false, message: 'AppSheet tardó demasiado en responder' });
    }
    
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// ENDPOINT DE DATOS
app.get('/api/datos', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Solicitando datos...`);
    
    const [actividadesRes, vigentesRes] = await Promise.all([
      axios(buildRequest("ActividadesVigentes")),
      axios(buildRequest("ActividadVigente"))
    ]);

    const actividades = actividadesRes.data || [];
    const actividadVigente = vigentesRes.data || [];

    actividades.sort((a, b) => (a.Actividad || "").localeCompare(b.Actividad || ""));

    console.log(`[${new Date().toISOString()}] Datos enviados: ${actividades.length} actividades`);

    res.json({
      actividades,
      actividadVigente
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en /api/datos:`, error.message);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// RUTA RAÍZ
app.get('/', (req, res) => {
  res.json({ 
    message: 'API COAJ Backend funcionando',
    endpoints: {
      login: 'POST /api/login',
      datos: 'GET /api/datos',
      health: 'GET /health'
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor en puerto ${PORT}`);
  console.log(`📍 Endpoints disponibles:`);
  console.log(`   - POST /api/login`);
  console.log(`   - GET /api/datos`);
  console.log(`   - GET /health`);
});

// MANTENER SERVIDOR DESPIERTO
setInterval(() => {
  console.log('🏓 Ping para mantener servidor activo');
}, 10 * 60 * 1000);


// ENDPOINT DE INSCRIPCIÓN
app.post('/api/inscribir', async (req, res) => {
  try {
    const { actividad, usuario } = req.body;
    
    console.log('='.repeat(50));
    console.log(`[${new Date().toISOString()}] 📝 Inscripción nueva`);
    console.log(`   Usuario: ${usuario}`);
    console.log(`   Actividad: ${actividad}`);

    const response = await axios({
      url: `https://api.appsheet.com/api/v2/apps/${CONFIG.appId}/tables/Preinscripcion/Action?applicationAccessKey=${CONFIG.accessKey}`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: {
        "Action": "Add",
        "Properties": {
          "Locale": "es-MX",
          "Timezone": "Central Standard Time"
        },
        "Rows": [
          {
            "Actividad": actividad,
            "Usuario": usuario
          }
        ]
      },
      timeout: 30000
    });

    console.log(`[${new Date().toISOString()}] ✅ Inscripción exitosa`);
    console.log('='.repeat(50));

    res.json({
      success: true,
      message: '¡Inscripción exitosa!'
    });

  } catch (error) {
    console.error('='.repeat(50));
    console.error(`[${new Date().toISOString()}] ❌ Error en inscripción:`, error.message);
    if (error.response && error.response.data) {
      console.error('Detalles del error:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('='.repeat(50));
    
    res.status(500).json({ 
      success: false, 
      message: 'Error al inscribirse. Intenta de nuevo.' 
    });
  }
});













