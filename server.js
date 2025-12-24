const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
  appId: "b6fac65a-32b5-445f-8831-d6f1be2b4433",
  accessKey: "V2-0kr7X-HiVCr-XkEZL-LE5qD-Rdl5Z-PDdhL-Ga3v8-B0j2w"
};

app.use(cors());
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

app.post('/api/login', async (req, res) => {
  try {
    const { alias, contrasena } = req.body;
    
    console.log(`[${new Date().toISOString()}] Login intento: ${alias}`);
    const startTime = Date.now();

    // BUSCAR EN LA TABLA UsuariosLoginActividades (sin relaciones)
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
      timeout: 10000
    });

    const responseTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] AppSheet respondió en ${responseTime}ms`);

    const usuarios = response.data || [];

    if (usuarios.length === 0) {
      console.log(`[${new Date().toISOString()}] Usuario no encontrado: ${alias}`);
      return res.json({ success: false, message: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];

    if (usuario.Contraseña === contrasena) {
      console.log(`[${new Date().toISOString()}] Login exitoso: ${alias} (${responseTime}ms)`);
      return res.json({
        success: true,
        usuario: {
          alias: usuario.Alias,
          nombre: usuario.Usuario || usuario.Nombre || usuario.Alias
        }
      });
    } else {
      console.log(`[${new Date().toISOString()}] Contraseña incorrecta: ${alias}`);
      return res.json({ success: false, message: 'Contraseña incorrecta' });
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en login:`, error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ success: false, message: 'Tiempo de espera agotado' });
    }
    
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'API COAJ Backend funcionando' });
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
