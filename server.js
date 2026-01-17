const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
  appId: "b6fac65a-32b5-445f-8831-d6f1be2b4433",
  accessKey: "V2-0kr7X-HiVCr-XkEZL-LE5qD-Rdl5Z-PDdhL-Ga3v8-B0j2w",
  baseUrl: "https://api.appsheet.com/api/v2/apps"
};

const apiUrl = (tabla) => `${CONFIG.baseUrl}/${CONFIG.appId}/tables/${tabla}/Action?applicationAccessKey=${CONFIG.accessKey}`;

app.use(require('cors')());
app.use(express.json());

// Fetch helper
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

// LOGIN
app.post('/api/login', async (req, res) => {
  const { alias, contrasena } = req.body;
  if (!alias || !contrasena) return res.json({ success: false, message: 'Alias y contraseña requeridos' });

  try {
    const data = await appsheet('Usuarios', 'Find', `Filter(Usuarios, [Alias]="${alias}")`);
    const u = data?.[0];
    
    if (!u) return res.json({ success: false, message: 'Usuario no encontrado' });
    if (u.Contraseña !== contrasena) return res.json({ success: false, message: 'Contraseña incorrecta' });
    if (u['Sanciones:'] === 'TRUE' || u['Sanciones:'] === true) {
      return res.json({ success: false, message: 'Usuario bloqueado por sanciones' });
    }

    res.json({
      success: true,
      usuario: { alias: u.Alias, nombre: u.Usuario || u.Alias, email: u.Email || '', centro: u['Centro Juvenil'] || '' }
    });
  } catch (e) {
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

// VERIFICAR ALIAS
app.post('/api/verificar-alias', async (req, res) => {
  const { alias } = req.body;
  if (!alias) return res.json({ disponible: false });

  try {
    const data = await appsheet('Usuarios', 'Find', `Filter(Usuarios, [Alias]="${alias}")`);
    res.json({ disponible: !data?.length });
  } catch (e) {
    res.json({ disponible: false, error: true });
  }
});

// DATOS
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

// CATALOGOS
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

// INSCRIPCIÓN
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

// WARMUP & HEALTH
app.get('/api/warmup', (req, res) => res.json({ status: 'warm', ts: Date.now() }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ api: 'COAJ', status: 'activa' }));


// EVENTOS
app.get('/api/eventos', async (req, res) => {
  try {
    const eventos = await appsheet('Eventos', 'Find', 'Filter(Eventos, true)');
    res.json({ eventos: eventos || [] });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener eventos', eventos: [] });
  }
});


app.listen(PORT, () => console.log(`✅ Puerto ${PORT}`));
