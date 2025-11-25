const AWS = require('aws-sdk');
require('dotenv').config();

AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const sqs = new AWS.SQS();
const QUEUE_URL = process.env.SQS_QUEUE_URL;

const procesarMensajes = async () => {
    try {
        // Long Polling (espera hasta 20s si no hay mensajes)
        const data = await sqs.receiveMessage({
            QueueUrl: QUEUE_URL,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20
        }).promise();

        if (data.Messages) {
            for (const message of data.Messages) {
                const venta = JSON.parse(message.Body);
                console.log(`📧 [EMAIL SIMULADO] Enviando confirmación a ${venta.cliente} por total de $${venta.total}`);
                
                // IMPORTANTE: Borrar mensaje de la cola para no procesarlo de nuevo
                await sqs.deleteMessage({
                    QueueUrl: QUEUE_URL,
                    ReceiptHandle: message.ReceiptHandle
                }).promise();
            }
        }
    } catch (error) {
        console.error("Error en worker:", error);
    }
    
    // Volver a llamar inmediatamente
    setImmediate(procesarMensajes);
};

console.log("🚀 Notification Worker Iniciado...");
procesarMensajes();