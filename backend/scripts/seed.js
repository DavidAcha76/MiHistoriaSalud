import bcrypt from 'bcryptjs';
import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { randomId } from '../src/utils/security.js';

if (!env.seedDemo) {
  console.log('SEED_DEMO=false; no se insertaron datos de demostración.');
  process.exit(0);
}

const [existing] = await db.execute('SELECT id FROM users WHERE email=? LIMIT 1', [env.demo.email]);
if (existing.length) {
  console.log(`Usuario demo ya existe: ${env.demo.email}`);
  await db.end();
  process.exit(0);
}

const userId = randomId();
const profileId = randomId();
const passwordHash = await bcrypt.hash(env.demo.password, 12);
const conn = await db.getConnection();
try {
  await conn.beginTransaction();
  await conn.execute('INSERT INTO users (id,email,password_hash,full_name) VALUES (?,?,?,?)', [userId, env.demo.email, passwordHash, 'Usuario Demo']);
  await conn.execute(`INSERT INTO health_profiles (id,owner_user_id,display_name,birth_date,relationship,notes) VALUES (?,?,?,'1995-05-20','SELF',?)`, [profileId, userId, 'Perfil Demo', 'Datos totalmente ficticios para pruebas académicas.']);

  const examples = [
    { type:'ALLERGY', title:'Alergia ficticia registrada', date:'2021-03-12', description:'Registro sintético para demostrar el módulo de alergias.', source:'Demo', table:'allergies', fields:['allergen','reaction','severity','status'], values:['Ejemplo sintético','Reacción ficticia','Leve','Activa'] },
    { type:'MEDICATION', title:'Medicamento de demostración', date:'2025-11-04', description:'Registro sintético; no representa una indicación médica.', source:'Demo', table:'medications', fields:['medication_name','dose','frequency','route','start_date','end_date','status'], values:['Medicamento demo','Dosis demo','Frecuencia demo','Oral','2025-11-04',null,'Finalizado'] },
    { type:'LAB_RESULT', title:'Resultado de laboratorio de demostración', date:'2026-06-15', description:'Valor ficticio sin interpretación clínica.', source:'Laboratorio Demo', table:'lab_results', fields:['test_name','value_text','value_numeric','unit','reference_range','flag','laboratory'], values:['Prueba demo','Valor ficticio',null,'unidad','rango demo','Sin interpretar','Laboratorio Demo'] },
    { type:'CONSULTATION', title:'Consulta de demostración', date:'2026-07-20', description:'Consulta ficticia para mostrar la línea de tiempo.', source:'Centro Demo', table:'consultations', fields:['professional_name','specialty','facility','reason'], values:['Profesional Demo','Especialidad Demo','Centro Demo','Prueba académica del sistema'] }
  ];
  for (const e of examples) {
    const eventId = randomId();
    await conn.execute(`INSERT INTO health_events (id,profile_id,event_type,title,description,event_date,source,created_by_user_id) VALUES (?,?,?,?,?,?,?,?)`, [eventId, profileId, e.type, e.title, e.description, e.date, e.source, userId]);
    await conn.execute(`INSERT INTO ${e.table} (event_id,${e.fields.join(',')}) VALUES (${['?', ...e.fields.map(() => '?')].join(',')})`, [eventId, ...e.values]);
  }
  await conn.commit();
  console.log('Datos demo insertados.');
  console.log(`Correo: ${env.demo.email}`);
  console.log(`Contraseña: ${env.demo.password}`);
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
  await db.end();
}
