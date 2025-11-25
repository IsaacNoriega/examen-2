const { createMetricsLogger, Unit } = require("aws-embedded-metrics");

// Detectamos el ambiente
const ENV = process.env.NODE_ENV || "LOCAL";

const logMetric = async (metricName, value, unit = Unit.Count) => {
    // 1. Siempre imprimimos en consola (Logs básicos)
    console.log(`[METRICA - ${ENV}] ${metricName}: ${value}`);

    // 2. Solo si es PRODUCCION enviamos a CloudWatch
    if (ENV === "PRODUCTION") {
        const metrics = createMetricsLogger();
        metrics.setNamespace("ExamenFinal/Ventas");
        metrics.putDimensions({ Environment: "PRODUCTION" });
        metrics.putMetric(metricName, value, unit);
        await metrics.flush();
    }
};

module.exports = { logMetric, Unit };