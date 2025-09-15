import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

const createPackage = asyncHandler(async (req, res) => {
    const { Package } = getModels(req.gymDBConnection);
    const { name, description, tipoClase, price, creditsToReceive, isActive } = req.body;

    if (!name || !tipoClase || !price || !creditsToReceive) {
        res.status(400);
        throw new Error('El nombre, tipo de clase, precio y cantidad de créditos son obligatorios.');
    }

    const newPackage = await Package.create({
        name,
        description,
        tipoClase,
        price,
        creditsToReceive,
        isActive,
    });

    res.status(201).json(newPackage);
});

const getPackages = asyncHandler(async (req, res) => {
    const { Package } = getModels(req.gymDBConnection);
    
    // Si la petición viene de un admin, muestra todos. Si no, solo los activos.
    const query = req.user?.roles.includes('admin') ? {} : { isActive: true };

    const packages = await Package.find(query)
        .populate('tipoClase', 'nombre')
        .sort({ createdAt: -1 });

    res.json(packages);
});

const updatePackage = asyncHandler(async (req, res) => {
    const { Package } = getModels(req.gymDBConnection);
    const { name, description, tipoClase, price, creditsToReceive, isActive } = req.body;

    const pkg = await Package.findById(req.params.id);

    if (!pkg) {
        res.status(404);
        throw new Error('Paquete no encontrado.');
    }

    pkg.name = name || pkg.name;
    pkg.description = description || pkg.description;
    pkg.tipoClase = tipoClase || pkg.tipoClase;
    pkg.price = price || pkg.price;
    pkg.creditsToReceive = creditsToReceive || pkg.creditsToReceive;
    pkg.isActive = isActive !== undefined ? isActive : pkg.isActive;

    const updatedPackage = await pkg.save();
    res.json(updatedPackage);
});

const deletePackage = asyncHandler(async (req, res) => {
    const { Package } = getModels(req.gymDBConnection);
    const pkg = await Package.findById(req.params.id);

    if (pkg) {
        await pkg.deleteOne();
        res.json({ message: 'Paquete eliminado correctamente.' });
    } else {
        res.status(404);
        throw new Error('Paquete no encontrado.');
    }
});

export { createPackage, getPackages, updatePackage, deletePackage };