const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// URLs
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwE3_Ss2BDhoFyYNKQ87495uAKF4mY0pg2zEc32wJ8MFpca35FwRVpW7S5tpkBy0huuCQ/exec";

const CONFIG = {
  appId: "b6fac65a-32b5-445f-8831-d6f1be2b4433",
  accessKey: "V2-0kr7X-HiVCr-XkEZL-LE5qD-Rdl5Z-PDdhL-Ga3v8-B0j2w",
  baseUrl: "https://api.appsheet.com/api/v2/apps"
};

const apiUrl = (tabla) => `${CONFIG.baseUrl}/${CONFIG.appId}/tables/${tabla}/Action?applicationAccessKey=${CONFIG.accessKey}`;

app.use(require('cors')());
app.use(express.json());

// Fetch helper para AppSheet
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

// LOGIN - USA WEB APP
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

// VERIFICAR ALIAS - USA WEB APP
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

// REGISTRO - CON CENTRO JUVENIL
app.post('/api/registro', async (req, res) => {
  const { alias, contrasena, usuario, email, fechaNacimiento, sexo, municipio, distrito, direccion, movil, centroJuvenil } = req.body;
  if (!alias || !contrasena || !usuario || !email) {
    return res.json({ success: false, message: 'Alias, contraseña, nombre y email son requeridos' });
  }

  try {
    const existe = await appsheet('Usuarios', 'Find', `Filter(Usuarios, [Alias]="${alias}")`);
    if (existe?.length > 0) return res.json({ success: false, message: 'El alias ya está registrado', existe: true });

    await appsheet('Usuarios', 'Add', null, [{
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
      "Centro Juvenil": centroJuvenil || "", 
      Puesto: "Usuario",
      Autorización: "Y", 
      "Sanciones:": "FALSE"
    }]);

    res.json({ success: true, message: 'Usuario registrado correctamente' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error al registrar' });
  }
});

// CENTROS JUVENILES
app.get('/api/centros', async (req, res) => {
  try {
    const centros = await appsheet('Centros Juveniles', 'Find');
    res.json({ 
      centros: (centros || []).map(x => ({ 
        id: x.Id || x["Row ID"], 
        nombre: x["Centro Juvenil"] || x.Nombre 
      })) 
    });
  } catch (e) {
    res.status(500).json({ error: 'Error', centros: [] });
  }
});

// ORDEN DE DÍAS
const ordenDias = {
  'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
  'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6, 'domingo': 7
};

function obtenerOrdenDia(diasStr) {
  if (!diasStr) return 99;
  const dias = diasStr.toLowerCase().split(/[,\s]+/).filter(d => d.trim());
  const ordenes = dias.map(d => ordenDias[d.trim()] || 99);
  return Math.min(...ordenes);
}

// DATOS - CON ORDENAMIENTO POR DÍA
app.get('/api/datos', async (req, res) => {
  try {
    const [actividades, actividadVigente] = await Promise.all([
      appsheet('ActividadesVigentes', 'Find', 'Filter(ActividadesVigentes, true)'),
      appsheet('ActividadVigente', 'Find', 'Filter(ActividadVigente, true)')
    ]);
    
    const actividadesOrdenadas = (actividades || []).sort((a, b) => {
      const diaA = obtenerOrdenDia(a["Días"]);
      const diaB = obtenerOrdenDia(b["Días"]);
      if (diaA !== diaB) return diaA - diaB;
      return (a.Actividad || "").localeCompare(b.Actividad || "");
    });
    
    res.json({
      actividades: actividadesOrdenadas,
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

// INSCRIPCIÓN - CON VALIDACIONES VIA WEB APP
app.post('/api/inscribir', async (req, res) => {
  const { actividadId, usuario, fechaNacimiento, sancion } = req.body;
  if (!actividadId || !usuario) return res.json({ success: false, message: 'Datos incompletos' });

  try {
    const sancionStr = (sancion || "").toString().toUpperCase();
    if (sancionStr === "TRUE" || sancionStr === "Y" || sancionStr === "1") {
      return res.json({ success: false, message: 'No puedes inscribirte debido a una sanción activa. Contacta con tu centro juvenil.' });
    }

    if (fechaNacimiento) {
      let nac;
      if (typeof fechaNacimiento === 'string' && fechaNacimiento.includes('/')) {
        const p = fechaNacimiento.split(' ')[0].split('/');
        nac = new Date(+p[2], +p[0] - 1, +p[1]);
      } else {
        nac = new Date(fechaNacimiento);
      }
      
      if (!isNaN(nac)) {
        const hoy = new Date();
        let edad = hoy.getFullYear() - nac.getFullYear();
        const mes = hoy.getMonth() - nac.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad--;
        
        if (edad < 14) {
          return res.json({ success: false, message: 'Debes tener al menos 14 años para inscribirte.' });
        }
        if (edad > 30) {
          return res.json({ success: false, message: 'COAJ está dirigido a jóvenes de 14 a 30 años.' });
        }
      }
    }

    const verificar = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verificar-inscripcion', actividadId, usuario })
    });
    const check = await verificar.json();
    
    if (check.yaInscrito) {
      return res.json({ success: false, message: 'Ya estás inscrito en esta actividad.' });
    }

    await appsheet('Preinscripcion', 'Add', null, [{ Actividad: actividadId, Usuario: usuario }]);
    res.json({ success: true, message: 'Inscripción exitosa' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error al inscribirse' });
  }
});

// OLVIDÉ MI CONTRASEÑA
app.post('/api/olvide-contrasena', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ success: false, message: 'Email requerido' });

  try {
    const usuarios = await appsheet('Usuarios', 'Find', `Filter(Usuarios, [Email]="${email}")`);
    
    if (!usuarios || usuarios.length === 0) {
      return res.json({ success: false, message: 'No encontramos una cuenta con ese correo' });
    }

    const usuario = usuarios[0];
    await appsheet('OlvideMiContraseña', 'Add', null, [{ Usuario: usuario.Alias }]);
    
    res.json({ success: true, message: 'Te enviaremos tu contraseña por correo' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error al procesar solicitud' });
  }
});

// EVENTOS
app.get('/api/eventos', async (req, res) => {
  try {
    const eventos = await appsheet('Eventos', 'Find', 'Filter(Eventos, true)');
    res.json({ eventos: eventos || [] });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener eventos', eventos: [] });
  }
});

// EXPOSICIONES
app.get('/api/exposiciones', async (req, res) => {
  try {
    const exposiciones = await appsheet('EstadoExposicionesActivas', 'Find', 'Filter(EstadoExposicionesActivas, true)');
    res.json({ exposiciones: exposiciones || [] });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener exposiciones', exposiciones: [] });
  }
});

// ESPACIOS - BACKEND COMPLETO
app.get('/api/espacios', async (req, res) => {
  try {
    const espacios = await appsheet('SalasPorEspacio', 'Find', 'Filter(SalasPorEspacio, true)');
    
    const espaciosMapeados = (espacios || []).map(e => ({
      id: e.IdSala,
      nombre: e.Nombre,
      tipo: e.Tipo,
      coaj: e.COAJ,
      capacidad: getCapacidadPorNombre(e.Nombre), // Función helper
      desc: `Espacio ${e.Nombre} en ${e.COAJ}`,
      photos: [], // TODO: manejar Related FotosPorSalaEspacios si necesario
      precio: getPrecioPorTipo(e.Tipo),
      duracion: getDuracionPorTipo(e.Tipo)
    }));
    
    res.json({ espacios: espaciosMapeados });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener espacios', espacios: [] });
  }
});

// DISPONIBILIDAD - BASADA EN CESIONES
app.get('/api/disponibilidad/:salaNombre/:fecha', async (req, res) => {
  const { salaNombre, fecha } = req.params;
  try {
    // Obtener cesiones para esa sala y fecha
    const cesiones = await appsheet('Cesiones', 'Find', 
      `Filter(Cesiones, AND([Sala]="${salaNombre}", [Fecha]="${fecha}"))`);
    
    const horasOcupadas = [];
    
    (cesiones || []).forEach(cesion => {
      const inicio = cesion['Hora de inicio'];
      const fin = cesion['Hora de finalización'];
      
      if (inicio && fin) {
        // Convertir a horas simples (ej: "09:00:00" → "09:00")
        const horaInicio = inicio.substring(0, 5);
        const horaFin = fin.substring(0, 5);
        horasOcupadas.push({ inicio: horaInicio, fin: horaFin });
      }
    });
    
    res.json({ horasOcupadas });
  } catch (e) {
    res.status(500).json({ error: 'Error disponibilidad', horasOcupadas: [] });
  }
});

// RESERVAR - CREAR CESIÓN
app.post('/api/reservar', async (req, res) => {
  const { salaId, salaNombre, centro, fecha, hora, usuario } = req.body;
  if (!salaNombre || !fecha || !hora || !usuario) {
    return res.json({ success: false, message: 'Datos incompletos' });
  }

  try {
    // Verificar disponibilidad
    const cesiones = await appsheet('Cesiones', 'Find', 
      `Filter(Cesiones, AND([Sala]="${salaNombre}", [Fecha]="${fecha}"))`);
    
    const horaReserva = hora.substring(0, 5); // "10:00"
    const horaFin = sumarHora(horaReserva, 2); // 2 horas después
    
    // Verificar conflictos
    const conflicto = (cesiones || []).some(c => {
      const inicio = (c['Hora de inicio'] || '').substring(0, 5);
      const fin = (c['Hora de finalización'] || '').substring(0, 5);
      return hayConflictoHorario(horaReserva, horaFin, inicio, fin);
    });
    
    if (conflicto) {
      return res.json({ success: false, message: 'Horario no disponible' });
    }

    // Crear cesión
    await appsheet('Cesiones', 'Add', null, [{
      'Programa': 'Reserva Web',
      'Centro Juvenil': centro,
      'Tipo de Cesion': 'Externa',
      'Espacio': salaId,
      'EntidadID': usuario,
      'Clasificacion': 'Reserva',
      'Modalidad de Sesion': 'Presencial',
      'Nombre': `Reserva ${salaNombre}`,
      'Descripcion': `Reserva web por ${usuario}`,
      'Fecha': fecha,
      'Hora de inicio': horaReserva + ':00',
      'Hora de finalización': horaFin + ':00',
      'Duración': '02:00:00',
      'Sala': salaNombre
    }]);

    res.json({ success: true, message: 'Reserva confirmada' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error al reservar' });
  }
});

// HELPERS
function getCapacidadPorNombre(nombre) {
  const capacidades = {
    'Dinamización': 25, 'Dinamización 1': 25, 'Dinamización 2': 20,
    'Sala 3': 15, 'Sala 4': 12, 'Sala de espejos': 15,
    'Coworking': 20, 'Cyber': 12, 'Sala de ordenadores': 18,
    'Sala de juegos': 20, 'Artes escénicas 1 (Espejos)': 20,
    'Espacio de arte': 12, 'Oficina de Información Juvenil': 5,
    'Psicología y coaching': 2
  };
  return capacidades[nombre] || 10;
}

function getPrecioPorTipo(tipo) {
  const precios = {
    'Ocio y Tiempo Libre': 'Gratuito',
    'Estudio y formación': 'Gratuito', 
    'Música y desarrollo': '5 €/hora',
    'Otros': 'Gratuito'
  };
  return precios[tipo] || 'Gratuito';
}

function getDuracionPorTipo(tipo) {
  const duraciones = {
    'Ocio y Tiempo Libre': '2 horas',
    'Estudio y formación': '4 horas',
    'Música y desarrollo': '1 hora', 
    'Otros': '30 min'
  };
  return duraciones[tipo] || '2 horas';
}

function sumarHora(hora, horas) {
  const [h, m] = hora.split(':').map(Number);
  const nueva = h + horas;
  return `${String(nueva).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hayConflictoHorario(inicioA, finA, inicioB, finB) {
  return inicioA < finB && finA > inicioB;
};

// ACTUALIZAR DNI/FOTO - USA WEB APP
app.post('/api/actualizar-foto', async (req, res) => {
  const { alias, fotoUrl } = req.body;
  
  if (!alias || !fotoUrl) {
    return res.json({ success: false, message: 'Datos incompletos' });
  }

  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'actualizar-foto', alias, fotoUrl })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.error('Error actualizando foto:', e);
    res.status(500).json({ success: false, message: 'Error al actualizar' });
  }
});



// WARMUP & HEALTH
app.get('/api/warmup', (req, res) => res.json({ status: 'warm', ts: Date.now() }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ api: 'COAJ', status: 'activa' }));

app.listen(PORT, () => console.log(`✅ Puerto ${PORT}`));
