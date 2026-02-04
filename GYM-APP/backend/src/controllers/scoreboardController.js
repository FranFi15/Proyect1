import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';


const createScoreboard = asyncHandler(async (req, res) => {
    const { Scoreboard } = getModels(req.gymDBConnection);
    const { nombre, descripcion, fechaLimite, metrics, metricUnit } = req.body;

    if (!nombre) {
        res.status(400);
        throw new Error('El nombre del desafío es obligatorio');
    }

    const scoreboard = await Scoreboard.create({
        nombre,
        descripcion,
        // Si fechaLimite viene vacía o null, se guarda como null (Eterno)
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        metrics, // Array ej: ['peso', 'tiempo']
        metricUnit // String ej: 'kg'
    });

    res.status(201).json(scoreboard);
});


const updateScoreboard = asyncHandler(async (req, res) => {
    const { Scoreboard } = getModels(req.gymDBConnection);
    const scoreboard = await Scoreboard.findById(req.params.id);

    if (!scoreboard) {
        res.status(404);
        throw new Error('Scoreboard no encontrado');
    }

    scoreboard.nombre = req.body.nombre || scoreboard.nombre;
    scoreboard.descripcion = req.body.descripcion !== undefined ? req.body.descripcion : scoreboard.descripcion;
    scoreboard.metrics = req.body.metrics || scoreboard.metrics;
    scoreboard.metricUnit = req.body.metricUnit !== undefined ? req.body.metricUnit : scoreboard.metricUnit;
    
    // Lógica inteligente para fecha límite
    if (req.body.fechaLimite !== undefined) {
        // Permite borrar la fecha límite enviando null para hacerlo "Eterno" de nuevo
        scoreboard.fechaLimite = req.body.fechaLimite ? new Date(req.body.fechaLimite) : null;
    }

    if (req.body.visible !== undefined) {
        scoreboard.visible = req.body.visible;
    }

    const updated = await scoreboard.save();
    res.json(updated);
});


const deleteScoreboard = asyncHandler(async (req, res) => {
    const { Scoreboard, ScoreboardEntry } = getModels(req.gymDBConnection);
    const scoreboard = await Scoreboard.findById(req.params.id);

    if (!scoreboard) {
        res.status(404);
        throw new Error('Scoreboard no encontrado');
    }

    // Eliminación en cascada: Borramos todos los resultados asociados primero
    await ScoreboardEntry.deleteMany({ scoreboard: scoreboard._id });
    await scoreboard.deleteOne();

    res.json({ message: 'Scoreboard y sus resultados eliminados correctamente' });
});


const getActiveScoreboards = asyncHandler(async (req, res) => {
    const { Scoreboard, ScoreboardEntry } = getModels(req.gymDBConnection);
    
    const now = new Date();

    // FILTRO: Queremos los que sean visibles Y (no tengan fecha limite O la fecha limite sea futura)
    const query = {
        visible: true,
        $or: [
            { fechaLimite: null },          // Opción A: Es eterno
            { fechaLimite: { $gt: now } }   // Opción B: Vence en el futuro
        ]
    };

    // Ordenamos por urgencia: primero los que vencen pronto, luego los eternos (null va al final usualmente)
    // Si prefieres al revés, ajusta el sort.
    const scoreboards = await Scoreboard.find(query).sort({ fechaLimite: 1, createdAt: -1 });

    // Enriquecemos la respuesta indicando si el usuario YA completó el desafío
    const scoreboardsWithStatus = await Promise.all(scoreboards.map(async (sb) => {
        const entry = await ScoreboardEntry.findOne({
            scoreboard: sb._id,
            user: req.user._id
        });

        return {
            ...sb.toObject(),
            completedByUser: !!entry, // true/false para pintar el botón en el front
            userEntryId: entry ? entry._id : null,
            // Helper para el front: saber si mostrar "Vence el..." o "Desafío Permanente"
            isLimitedTime: !!sb.fechaLimite 
        };
    }));

    res.json(scoreboardsWithStatus);
});


const submitScore = asyncHandler(async (req, res) => {
    const { ScoreboardEntry, Scoreboard } = getModels(req.gymDBConnection);
    const { scoreboardId, peso, tiempo, distancia, repeticiones, nota, rx } = req.body;

    const scoreboard = await Scoreboard.findById(scoreboardId);
    if (!scoreboard) {
        res.status(404);
        throw new Error('El scoreboard ya no existe');
    }

    // Buscamos si ya existe una entrada de este usuario para este scoreboard (Upsert logic)
    let entry = await ScoreboardEntry.findOne({
        scoreboard: scoreboardId,
        user: req.user._id
    });

    if (entry) {
        // Si existe, actualizamos
        entry.peso = peso ?? entry.peso;
        entry.tiempo = tiempo ?? entry.tiempo;
        entry.distancia = distancia ?? entry.distancia;
        entry.repeticiones = repeticiones ?? entry.repeticiones;
        entry.nota = nota ?? entry.nota;
        entry.rx = rx ?? entry.rx;
        await entry.save();
    } else {
        // Si no existe, creamos
        entry = await ScoreboardEntry.create({
            scoreboard: scoreboardId,
            user: req.user._id,
            peso,
            tiempo,
            distancia,
            repeticiones,
            nota,
            rx
        });
    }

    res.status(201).json({ message: 'Resultado guardado con éxito', entry });
});


const getLeaderboard = asyncHandler(async (req, res) => {
    const { ScoreboardEntry, User, Scoreboard } = getModels(req.gymDBConnection);
    const { scoreboardId } = req.params;
    const userId = req.user._id;
    
    // Verificamos permisos especiales
    const isAdminOrProf = req.user.roles.includes('admin') || req.user.roles.includes('profesor');

    // 1. Buscamos el scoreboard para saber cómo ordenar (opcional, por ahora orden genérico)
    const scoreboard = await Scoreboard.findById(scoreboardId);
    if (!scoreboard) {
        res.status(404); throw new Error('Scoreboard no encontrado');
    }

    // 2. Verificamos si el usuario actual ya cargó su resultado
    const userEntry = await ScoreboardEntry.findOne({ scoreboard: scoreboardId, user: userId });


    if (!userEntry && !isAdminOrProf) {
        return res.status(200).json({
            locked: true,
            message: "Para ver el ranking y compararte, primero debes cargar tu resultado.",
            scoreboardName: scoreboard.nombre,
            metrics: scoreboard.metrics, // Para que el front sepa qué inputs mostrar en el form
            metricUnit: scoreboard.metricUnit,
            entries: [] // Array vacío intencional
        });
    }

    const entries = await ScoreboardEntry.find({ scoreboard: scoreboardId })
        .populate('user', 'nombre apellido') // Solo mostramos datos públicos
        .sort({ rx: -1, peso: -1, repeticiones: -1, distancia: -1, tiempo: 1 }); 

    res.json({
        locked: false,
        scoreboardName: scoreboard.nombre,
        userEntry: userEntry, // Devolvemos su propio resultado separado para resaltarlo en la UI
        entries: entries
    });
});

export {
    createScoreboard,
    updateScoreboard,
    deleteScoreboard,
    getActiveScoreboards,
    submitScore,
    getLeaderboard
};