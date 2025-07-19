export const sendExpoPushNotification = async (pushToken, title, body, data = {}) => {
    const isExpoToken = typeof pushToken === 'string' && pushToken.startsWith('ExponentPushToken');

    if (!isExpoToken) {
        console.error(`El token proporcionado no es un token de Expo válido: ${pushToken}`);
        return;
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
        
        const responseData = await response.json();
        if (responseData.data?.status === 'error') {
            console.error(`Error de Expo al enviar la notificación: ${responseData.data.message}`);
            console.error('Detalles:', responseData.data.details);
        } else {
            console.log(`Notificación push enviada exitosamente al token ${pushToken}`);
        }

    } catch (error) {
        console.error(`Falló el envío de notificación push para el token ${pushToken}:`, error);
    }
};