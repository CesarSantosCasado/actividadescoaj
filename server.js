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

// NUEVO: Endpoint para login
app.post('/api/login', async (req, res) => {
  try {
    const { alias, contrasena } = req.body;

    const response = await axios({
      url: `https://api.appsheet.com/api/v2/apps/${CONFIG.appId}/tables/Usuarios/Action?applicationAccessKey=${CONFIG.accessKey}`,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      data: {
        "Action": "Find",
        "Properties": {
          "Locale": "es-MX",
          "Timezone": "Central Standard Time",
          "Selector": `Filter(Usuarios, [Alias]="${alias}")`
        },
        "Rows": []
      }
    });

    const usuarios = response.data || [];

    if (usuarios.length === 0) {
      return res.json({ success: false, message: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];

    if (usuario.Contraseña === contrasena) {
      return res.json({
        success: true,
        usuario: {
          alias: usuario.Alias,
          nombre: usuario.Usuario || usuario.Alias
        }
      });
    } else {
      return res.json({ success: false, message: 'Contraseña incorrecta' });
    }

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

app.get('/api/datos', async (req, res) => {
  try {
    const [actividadesRes, vigentesRes] = await Promise.all([
      axios(buildRequest("ActividadesVigentes")),
      axios(buildRequest("ActividadVigente"))
    ]);

    const actividades = actividadesRes.data || [];
    const actividadVigente = vigentesRes.data || [];

    actividades.sort((a, b) => (a.Actividad || "").localeCompare(b.Actividad || ""));

    res.json({
      actividades,
      actividadVigente
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'API COAJ Backend funcionando' });
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
