const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// URLs
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxSgNVZou0wYkiY8XlehafsU_ge6kpwNjRSVQyEPvdCwiC1tdxR-MBEj4-EVnsz5Zg4sQ/exec";

const CONFIG = {
  appId: "b6fac65a-32b5-445f-8831-d6f1be2b4433",
  accessKey: "V2-0kr7X-HiVCr-XkEZL-LE5qD-Rdl5Z-PDdhL-Ga3v8-B0j2w",
  baseUrl: "https://api.appsheet.com/api/v2/apps"
};

const apiUrl = (tabla) => `${CONFIG.baseUrl}/${CONFIG.appId}/tables/${tabla}/Action?applicationAccessKey=${CONFIG.accessKey}`;

app.use(require('cors')());
app.use(express.json());

// Fetch helper para AppSheet (sigue igual)
const appsheet = async (tabla, action, selector = null, rows = []) => {
  const body = { Action: action, Properties: { Locale: "es-MX" }, Rows: rows };
  if (selector) body.Properties.Selector = selector;
  if (action === "Add") body.Properties.Timezone = "Central Standard Time";
  
  const res = await fetch(apiUrl(tabla), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
};

// LOGIN - AHORA USA WEB APP (RÁPIDO)
app.post('/api/login', async (req, res) => {
  const { alias, contrasena } = req.body;
  if (!alias || !contrasena) return res.json({ success: false, message: 'Alias y contraseña requeridos' });

  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', alias, contrasena })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// VERIFICAR ALIAS - AHORA USA WEB APP (RÁPIDO)
app.post('/api/verificar-alias', async (req, res) => {
  const { alias } = req.body;
  if (!alias) return res.json({ disponible: false });

  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verificar-alias', alias })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.json({ disponible: false, error: true });
  }
});

// REGISTRO - SIGUE CON APPSHEET
app.post('/api/registro', async (req, res) => {
  const { alias, contrasena, usuario, email, fechaNacimiento, sexo, municipio, distrito, direccion, movil } = req.body;
  if (!alias || !contrasena || !usuario || !email) {
    return res.json({ success: false, message: 'Alias, contraseña, nombre y email son requeridos' });
  }

  try {
    const existe = await appsheet('Usuarios', 'Find', `Filter(Usuarios, [Alias]="${alias}")`);
    if (existe?.length > 0) return res.json({ success: false, message: 'El alias ya está registrado', existe: true });

    await appsheet('Usuarios', 'Add', null, [{
      Alias: alias, Contraseña: contrasena, Usuario: usuario, Email: email,
      "Fecha de nacimiento": fechaNacimiento || "", Sexo: sexo || "Prefiero no decirlo",
      Municipio: municipio || "", Distrito: distrito || "", Dirección: direccion || "",
      Móvil: movil || "", "Centro Juvenil": "COAJ Ouka Leele", Puesto: "Usuario",
      Autorización: "Y", "Sanciones:": "FALSE"
    }]);

    res.json({ success: true, message: 'Usuario registrado correctamente' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error al registrar' });
  }
});

// DATOS - SIGUE IGUAL
app.get('/api/datos', async (req, res) => {
  try {
    const [actividades, actividadVigente] = await Promise.all([
      appsheet('ActividadesVigentes', 'Find', 'Filter(ActividadesVigentes, true)'),
      appsheet('ActividadVigente', 'Find', 'Filter(ActividadVigente, true)')
    ]);
    
    res.json({
      actividades: (actividades || []).sort((a, b) => (a.Actividad || "").localeCompare(b.Actividad || "")),
      actividadVigente: actividadVigente || []
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// CATALOGOS - SIGUE IGUAL
app.get('/api/catalogos', async (req, res) => {
  try {
    const [m, d, b] = await Promise.all([
      appsheet('Municipios', 'Find'),
      appsheet('Distritos', 'Find'),
      appsheet('Barrios', 'Find')
    ]);

    res.json({
      municipios: (m || []).map(x => ({ id: x.Id, nombre: x.Municipio })),
      distritos: (d || []).map(x => ({ id: x.Id, nombre: x.Distrito })),
      barrios: (b || []).map(x => ({ id: x.Id, nombre: x.Barrio, distrito: x.Distrito }))
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener catálogos' });
  }
});

// INSCRIPCIÓN - SIGUE IGUAL
app.post('/api/inscribir', async (req, res) => {
  const { actividad, usuario } = req.body;
  if (!actividad || !usuario) return res.json({ success: false, message: 'Datos incompletos' });

  try {
    await appsheet('Preinscripcion', 'Add', null, [{ Actividad: actividad, Usuario: usuario }]);
    res.json({ success: true, message: 'Inscripción exitosa' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error al inscribirse' });
  }
});

// EVENTOS - SIGUE IGUAL
app.get('/api/eventos', async (req, res) => {
  try {
    const eventos = await appsheet('Eventos', 'Find', 'Filter(Eventos, true)');
    res.json({ eventos: eventos || [] });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener eventos', eventos: [] });
  }
});

app.get('/api/exposiciones', async (req, res) => {
  try {
    const exposiciones = await appsheet('EstadoExposicionesActivas', 'Find', 'Filter(EstadoExposicionesActivas, true)');
    res.json({ exposiciones: exposiciones || [] });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener exposiciones', exposiciones: [] });
  }
});


// WARMUP & HEALTH - SIGUE IGUAL
app.get('/api/warmup', (req, res) => res.json({ status: 'warm', ts: Date.now() }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ api: 'COAJ', status: 'activa' }));

app.listen(PORT, () => console.log(`✅ Puerto ${PORT}`));
