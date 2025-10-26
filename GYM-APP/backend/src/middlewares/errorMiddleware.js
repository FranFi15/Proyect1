const notFound = (req, res, next) => {
    const error = new Error(`No Encontrado - ${req.originalUrl}`);
    res.status(404);
    next(error); 
};

const errorHandler = (err, req, res, next) => {
    // Si el status code ya fue establecido por un error anterior, lo mantenemos.
    // Si no, por defecto será 500 (Internal Server Error).
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        // En desarrollo, enviamos el stack trace para depuración.
        // En producción, no lo enviamos por seguridad.
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

export { notFound, errorHandler };