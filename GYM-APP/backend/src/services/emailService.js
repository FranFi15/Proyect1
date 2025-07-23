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

const sendEmailWithAttachment = async ({ to, subject, html, attachments }) => {
    if (!to || !subject || !html || !attachments) {
        throw new Error('Faltan parámetros para enviar el email con adjunto.');
    }

    try {
        await resend.emails.send({
            from: 'Reportes Gain <reports@gain-wellness.com>', // Puedes usar un remitente diferente para los reportes
            to: to,
            subject: subject,
            html: html,
            attachments: attachments, // Resend soporta esta propiedad directamente
        });
        console.log(`Email con adjunto enviado exitosamente a ${to}`);
    } catch (error) {
        console.error(`Falló el envío de email con adjunto para ${to}:`, error);
        throw new Error('El servicio de email no pudo enviar el mensaje con adjunto.');
    }
};

export {
    sendPasswordResetEmail,
    sendEmailWithAttachment,
};