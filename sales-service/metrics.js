const AWS = require('aws-sdk');

// Configuración regional
const cloudwatch = new AWS.CloudWatch({ region: process.env.AWS_REGION || 'us-east-1' });
const ENV = process.env.NODE_ENV || "LOCAL";

// Helper para enviar métricas
const logMetric = async (metricName, value, unit, dimensions = {}) => {
    
    //Log Local 
    console.log(`[METRICA - ${ENV}] ${metricName}: ${value} ${JSON.stringify(dimensions)}`);

    // 2. Envio a Nube 
    if (ENV === "PRODUCTION") {
        try {
            // Convertimos el objeto dimensions a formato AWS
            const awsDimensions = [
                { Name: 'Environment', Value: 'PROD' }, // Dimensión Fija
                ...Object.keys(dimensions).map(key => ({ Name: key, Value: dimensions[key] }))
            ];

            const params = {
                MetricData: [
                    {
                        MetricName: metricName,
                        Dimensions: awsDimensions,
                        Unit: unit,
                        Value: value
                    },
                ],
                Namespace: 'ExamenFinal/App' 
            };

            await cloudwatch.putMetricData(params).promise();
        } catch (error) {
            console.error("Error métrica:", error.message);
        }
    }
};

module.exports = { logMetric };