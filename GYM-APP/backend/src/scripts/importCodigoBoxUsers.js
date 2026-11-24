/**
 * One-shot import: Código Box Excel → codigobox_eb986898
 * Usage: node src/scripts/importCodigoBoxUsers.js [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import XLSX from 'xlsx';

const DRY = process.argv.includes('--dry-run');
const EXCEL = process.argv.find((a) => a.endsWith('.xlsx'))
    || 'c:/Users/Prueba/Downloads/Código Box (13) (1).xlsx';
const URI = process.env.IMPORT_MONGO_URI;
if (!URI) {
    console.error('Set IMPORT_MONGO_URI to the tenant Mongo connection string.');
    process.exit(1);
}
const ADMIN_URI = process.env.IMPORT_ADMIN_MONGO_URI
    || URI.replace(/\/[^/?]+(\?|$)/, '/Clientes$1');
const PASSWORD = process.env.IMPORT_DEFAULT_PASSWORD || 'codigo12345';
const DEFAULT_NAC = new Date('2000-01-01T12:00:00.000Z');

const splitName = (cliente) => {
    const parts = String(cliente || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { apellido: 'Sin', nombre: 'Nombre' };
    if (parts.length === 1) return { apellido: parts[0], nombre: parts[0] };
    return { apellido: parts[0], nombre: parts.slice(1).join(' ') };
};

const slug = (s) => String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40) || 'user';

const isValidEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const parseDate = (value) => {
    if (value == null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number') {
        // Excel serial
        const d = XLSX.SSF.parse_date_code(value);
        if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, 12));
    }
    const s = String(value).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`);
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
        const dd = dmy[1].padStart(2, '0');
        const mm = dmy[2].padStart(2, '0');
        return new Date(`${dmy[3]}-${mm}-${dd}T12:00:00.000Z`);
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
};

const endOfDay = (d) => {
    if (!d) return null;
    const x = new Date(d);
    x.setUTCHours(23, 59, 59, 999);
    return x;
};

const normalizePhone = (v) => {
    if (v == null || v === '') return '0000000000';
    return String(v).replace(/\s+/g, '').slice(0, 30) || '0000000000';
};

const isStaffAbono = (abono) => {
    const a = String(abono || '').trim().toLowerCase();
    return a === 'staff' || a === 'coach';
};

const isIlimitado = (abono) => {
    const a = String(abono || '').trim().toLowerCase();
    return a.includes('ilimitado') || a === 'samurai team';
};

const isCalistenia = (abono) => String(abono || '').toUpperCase().includes('CALISTENIA');

async function main() {
    if (!fs.existsSync(EXCEL)) throw new Error(`Excel not found: ${EXCEL}`);
    const wb = XLSX.readFile(EXCEL);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
    console.log(`Excel: ${path.basename(EXCEL)} → ${rows.length} rows | dryRun=${DRY}`);

    const gym = await mongoose.createConnection(URI).asPromise();
    const admin = await mongoose.createConnection(ADMIN_URI).asPromise();

    const tipoclases = await gym.db.collection('tipoclases').find({}).toArray();
    const universal = tipoclases.find((t) => t.esUniversal) || tipoclases.find((t) => /código box|codigo box/i.test(t.nombre));
    const calistenia = tipoclases.find((t) => /calistenia/i.test(t.nombre));
    if (!universal) throw new Error('No universal TipoClase found');
    console.log('credit types:', { universal: universal.nombre, calistenia: calistenia?.nombre || 'MISSING' });

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const usedEmails = new Set();
    const usedDnis = new Set();
    const existing = await gym.db.collection('users').find({}, { projection: { email: 1, dni: 1 } }).toArray();
    for (const u of existing) {
        if (u.email) usedEmails.add(String(u.email).toLowerCase());
        if (u.dni) usedDnis.add(String(u.dni));
    }

    const stats = {
        inserted: 0,
        skippedBlank: 0,
        skippedDup: 0,
        staff: 0,
        ilimitado: 0,
        calistenia: 0,
        credits: 0,
        generatedEmail: 0,
        generatedDni: 0,
        errors: [],
    };

    const docs = [];
    for (const r of rows) {
        if (!r.cliente || !String(r.cliente).trim()) {
            stats.skippedBlank++;
            continue;
        }

        const { apellido, nombre } = splitName(r.cliente);
        let email = isValidEmail(String(r.email || ''))
            ? String(r.email).toLowerCase().trim()
            : `${slug(apellido)}.${slug(nombre)}@codigo.local`;
        if (!isValidEmail(String(r.email || ''))) stats.generatedEmail++;

        // uniquify email if collision
        let baseEmail = email;
        let n = 2;
        while (usedEmails.has(email)) {
            const [local, domain] = baseEmail.split('@');
            email = `${local}${n}@${domain}`;
            n++;
        }
        usedEmails.add(email);

        let dni = r.DNI != null && r.DNI !== ''
            ? String(r.DNI).replace(/\D/g, '') || String(r.DNI).trim()
            : `TEMP${r.Cliente_id || docs.length}`;
        if (r.DNI == null || r.DNI === '') stats.generatedDni++;
        if (usedDnis.has(dni)) dni = `${dni}X${r.Cliente_id || docs.length}`;
        usedDnis.add(dni);

        const fechaNacimiento = parseDate(r.Nac) || DEFAULT_NAC;
        const phone = normalizePhone(r.Telefono);
        const abono = String(r.Abono || '').trim();
        const staff = isStaffAbono(abono);
        const roles = staff ? ['profesor'] : ['cliente'];
        if (staff) stats.staff++;

        const inicio = parseDate(r.Inicio);
        const vencimiento = endOfDay(parseDate(r.Vencimiento));
        const turnos = Number(r['Turnos Disponibles']) || 0;
        const isActive = String(r.Estado || '').toLowerCase() !== 'vencido';

        const doc = {
            nombre,
            apellido,
            email,
            contraseña: passwordHash,
            dni,
            fechaNacimiento,
            sexo: 'Otro',
            telefonoEmergencia: phone,
            numeroTelefono: phone === '0000000000' ? '' : phone,
            roles,
            creditosPorTipo: {},
            vencimientosDetallados: [],
            balance: Number(r.Saldo) || 0,
            isActive,
            isTrialOnly: false,
            todasLasSucursales: true,
            sucursales: [],
            clasesInscritas: [],
            historialAsistencias: [],
            monthlySubscriptions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            importMeta: {
                clienteIdLegacy: r.Cliente_id,
                abono,
                source: path.basename(EXCEL),
            },
        };

        if (isIlimitado(abono) || (staff && vencimiento)) {
            doc.paseLibreDesde = inicio || new Date();
            doc.paseLibreHasta = vencimiento || endOfDay(new Date('2035-12-31T12:00:00.000Z'));
            if (isIlimitado(abono)) stats.ilimitado++;
        } else if (turnos > 0) {
            const tipo = isCalistenia(abono) && calistenia ? calistenia : universal;
            const tipoId = String(tipo._id);
            doc.creditosPorTipo[tipoId] = turnos;
            doc.vencimientosDetallados.push({
                tipoClaseId: tipo._id,
                cantidad: turnos,
                fechaVencimiento: vencimiento || endOfDay(new Date('2099-12-31T12:00:00.000Z')),
                idCarga: `import-${r.Cliente_id || Date.now()}`,
            });
            if (isCalistenia(abono)) stats.calistenia++;
            else stats.credits++;
        }

        docs.push(doc);
    }

    console.log('Prepared', docs.length, 'users', stats);

    if (DRY) {
        console.log('DRY RUN sample', docs.slice(0, 3).map((d) => ({
            nombre: d.nombre, apellido: d.apellido, email: d.email, dni: d.dni, roles: d.roles,
            pase: !!d.paseLibreHasta, credits: d.creditosPorTipo, active: d.isActive,
        })));
        await gym.close();
        await admin.close();
        return;
    }

    if (docs.length) {
        // strip importMeta before insert (not in schema) — keep in a side log only
        const toInsert = docs.map(({ importMeta, ...rest }) => rest);
        const result = await gym.db.collection('users').insertMany(toInsert, { ordered: false }).catch(async (err) => {
            if (err.insertedDocs || err.result) return err;
            // partially inserted
            if (err.writeErrors) {
                stats.errors.push(...err.writeErrors.map((e) => e.errmsg));
                return { insertedCount: err.result?.nInserted || 0 };
            }
            throw err;
        });
        stats.inserted = result.insertedCount || Object.keys(result.insertedIds || {}).length;
    }

    const liveCount = await gym.db.collection('users').countDocuments({
        isActive: true,
        roles: 'cliente',
        isTrialOnly: { $ne: true },
    });
    // also count profesores? plan usually counts clientes; sync total active non-admin
    const activeClients = await gym.db.collection('users').countDocuments({
        isActive: true,
        isTrialOnly: { $ne: true },
        roles: { $in: ['cliente', 'profesor'] },
        email: { $ne: 'mariano.santa.fare@gmail.com' },
    });

    await admin.db.collection('clients').updateOne(
        { urlIdentifier: 'codigobox' },
        {
            $set: {
                clientLimit: Math.max(300, activeClients + 20),
                activeClientCount: activeClients,
            },
        }
    );

    console.log('DONE', {
        inserted: stats.inserted,
        skippedBlank: stats.skippedBlank,
        staff: stats.staff,
        ilimitado: stats.ilimitado,
        calisteniaCredits: stats.calistenia,
        otherCredits: stats.credits,
        generatedEmail: stats.generatedEmail,
        generatedDni: stats.generatedDni,
        liveUsers: await gym.db.collection('users').countDocuments(),
        activeClients,
        errors: stats.errors.slice(0, 10),
    });

    await gym.close();
    await admin.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
