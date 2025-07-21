import { Resend } from 'resend';

// Inicializa Resend una sola vez aquí
const resend = new Resend(process.env.RESEND_API_KEY);


const sendPasswordResetEmail = async ({ to, subject, html }) => {
    if (!to || !subject || !html) {
        throw new Error('Faltan parámetros para enviar el email de reseteo.');
    }

    try {
        await resend.emails.send({
            from: 'Gain <noreply@gain-wellness.com>', 
            to: to,
            subject: subject,
            html: html,
        });
        console.log(`Email de reseteo de contraseña enviado exitosamente a ${to}`);
    } catch (error) {
        console.error(`Falló el envío de email de reseteo para ${to}:`, error);
        // Volvemos a lanzar el error para que el controlador que lo llamó pueda manejarlo
        throw new Error('El servicio de email no pudo enviar el mensaje.');
    }
};

export {
    sendPasswordResetEmail
};