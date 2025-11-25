const AWS = require('aws-sdk');
require('dotenv').config();

AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const sqs = new AWS.SQS();
const QUEUE_URL = process.env.SQS_QUEUE_URL;

const procesarMensajes = async () => {
    try {

        const data = await sqs.receiveMessage({
            QueueUrl: QUEUE_URL,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20
        }).promise();

        if (data.Messages) {
            for (const message of data.Messages) {
                const venta = JSON.parse(message.Body);
                console.log(`📧 [EMAIL SIMULADO] Enviando confirmación a ${venta.cliente} por total de $${venta.total}`);
                
                await sqs.deleteMessage({
                    QueueUrl: QUEUE_URL,
                    ReceiptHandle: message.ReceiptHandle
                }).promise();
            }
        }
    } catch (error) {
        console.error("Error en worker:", error);
    }
    
    setImmediate(procesarMensajes);
};

console.log("Notification Worker Iniciado...");
procesarMensajes();