// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
  appId: "b6fac65a-32b5-445f-8831-d6f1be2b4433",
  accessKey: "V2-0kr7X-HiVCr-XkEZL-LE5qD-Rdl5Z-PDdhL-Ga3v8-B0j2w"
};

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
