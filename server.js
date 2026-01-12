const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
  appId: "b6fac65a-32b5-445f-8831-d6f1be2b4433",
  accessKey: "V2-0kr7X-HiVCr-XkEZL-LE5qD-Rdl5Z-PDdhL-Ga3v8-B0j2w",
  baseUrl: "https://api.appsheet.com/api/v2/apps"
};

const apiUrl = (tabla) => `${CONFIG.baseUrl}/${CONFIG.appId}/tables/${tabla}/Action?applicationAccessKey=${CONFIG.accessKey}`;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Accept'] }));
app.use(express.json());

// LOGIN
app.post('/api/login', async (req, res) => {
  const { alias, contrasena } = req.body;
  if (!alias || !contrasena) return res.json({ success: false, message: 'Alias y contraseña requeridos' });

  try {
    const { data } = await axios.post(apiUrl('Usuarios'), {
      Action: "Find",
      Properties: { Locale: "es-MX", Selector: `Filter(Usuarios, [Alias]="${alias}")` },
      Rows: []
    }, { timeout: 15000 });

    const usuario = (data || [])[0];
    if (!usuario) return res.json({ success: false, message: 'Usuario no encontrado' });
    if (usuario.Contraseña !== contrasena) return res.json({ success: false, message: 'Contraseña incorrecta' });

    res.json({
      success: true,
      usuario: { alias: usuario.Alias, nombre: usuario.Usuario || usuario.Alias }
    });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// REGISTRO
app.post('/api/registro', async (req, res) => {
  const { alias, contrasena, usuario, email, fechaNacimiento, sexo, municipio, distrito, direccion, movil } = req.body;
  
  if (!alias || !contrasena || !usuario || !email) {
    return res.json({ success: false, message: 'Alias, contraseña, nombre y email son requeridos' });
  }

  try {
    // Verificar si alias existe
    const { data: existe } = await axios.post(apiUrl('Usuarios'), {
      Action: "Find",
      Properties: { Locale: "es-MX", Selector: `Filter(Usuarios, [Alias]="${alias}")` },
      Rows: []
    }, { timeout: 15000 });

    if (existe && existe.length > 0) {
      return res.json({ success: false, message: 'El alias ya está registrado', existe: true });
    }

    // Crear usuario
    await axios.post(apiUrl('Usuarios'), {
      Action: "Add",
      Properties: { Locale: "es-MX", Timezone: "Central Standard Time" },
      Rows: [{
        Alias: alias,
        Contraseña: contrasena,
        Usuario: usuario,
        Email: email,
        "Fecha de nacimiento": fechaNacimiento || "",
        Sexo: sexo || "Prefiero no decirlo",
        Municipio: municipio || "",
        Distrito: distrito || "",
        Dirección: direccion || "",
        Móvil: movil || "",
        "Centro Juvenil": "COAJ Ouka Leele",
        Puesto: "Usuario",
        Autorización: "Y"
      }]
    }, { timeout: 15000 });

    res.json({ success: true, message: 'Usuario registrado correctamente' });
  } catch (e) {
    console.error('Registro error:', e.message);
    res.status(500).json({ success: false, message: 'Error al registrar' });
  }
});

// VERIFICAR ALIAS
app.post('/api/verificar-alias', async (req, res) => {
  const { alias } = req.body;
  if (!alias) return res.json({ disponible: false });

  try {
    const { data } = await axios.post(apiUrl('Usuarios'), {
      Action: "Find",
      Properties: { Locale: "es-MX", Selector: `Filter(Usuarios, [Alias]="${alias}")` },
      Rows: []
    }, { timeout: 10000 });

    res.json({ disponible: !data || data.length === 0 });
  } catch (e) {
    res.json({ disponible: false, error: true });
  }
});

// DATOS (actividades)
app.get('/api/datos', async (req, res) => {
  try {
    const buildReq = (tabla) => axios.post(apiUrl(tabla), {
      Action: "Find",
      Properties: { Locale: "es-MX", Selector: `Filter(${tabla}, true)` },
      Rows: []
    }, { timeout: 20000 });

    const [r1, r2] = await Promise.all([buildReq("ActividadesVigentes"), buildReq("ActividadVigente")]);
    
    res.json({
      actividades: (r1.data || []).sort((a, b) => (a.Actividad || "").localeCompare(b.Actividad || "")),
      actividadVigente: r2.data || []
    });
  } catch (e) {
    console.error('Datos error:', e.message);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// CATALOGOS
app.get('/api/catalogos', async (req, res) => {
  try {
    const buildReq = (tabla) => axios.post(apiUrl(tabla), {
      Action: "Find",
      Properties: { Locale: "es-MX" },
      Rows: []
    }, { timeout: 15000 });

    const [m, d, b] = await Promise.all([buildReq("Municipios"), buildReq("Distritos"), buildReq("Barrios")]);

    res.json({
      municipios: (m.data || []).map(x => ({ id: x.Id, nombre: x.Municipio })),
      distritos: (d.data || []).map(x => ({ id: x.Id, nombre: x.Distrito })),
      barrios: (b.data || []).map(x => ({ id: x.Id, nombre: x.Barrio, distrito: x.Distrito }))
    });
  } catch (e) {
    console.error('Catalogos error:', e.message);
    res.status(500).json({ error: 'Error al obtener catálogos' });
  }
});

// INSCRIPCIÓN
app.post('/api/inscribir', async (req, res) => {
  const { actividad, usuario } = req.body;
  if (!actividad || !usuario) return res.json({ success: false, message: 'Datos incompletos' });

  try {
    await axios.post(apiUrl('Preinscripcion'), {
      Action: "Add",
      Properties: { Locale: "es-MX", Timezone: "Central Standard Time" },
      Rows: [{ Actividad: actividad, Usuario: usuario }]
    }, { timeout: 15000 });

    res.json({ success: true, message: 'Inscripción exitosa' });
  } catch (e) {
    console.error('Inscripcion error:', e.message);
    res.status(500).json({ success: false, message: 'Error al inscribirse' });
  }
});

// HEALTH
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.json({ message: 'API COAJ activa', endpoints: ['POST /api/login', 'POST /api/registro', 'GET /api/datos', 'GET /api/catalogos'] }));

app.listen(PORT, () => console.log(`✅ Servidor en puerto ${PORT}`));
