const express = require('express');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit'); 

const { logMetric } = require('./metrics');
require('dotenv').config();

const app = express();
app.use(express.json());

// CONFIGURACIÓN
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const MONGO_URI = process.env.MONGO_URI;

AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const s3 = new AWS.S3();
const sns = new AWS.SNS();

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ DB Conectada'))
    .catch(err => console.error('❌ Error DB:', err));

// MODELO COMPLETO
const VentaSchema = new mongoose.Schema({
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
    cliente_snapshot: {
        nombre: String,
        email: String,
        telefono: String,
        rfc: String,
        direccion: String
    },
    items: [{
        producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
        snapshot: {
            nombre: String,
            descripcion: String,
            precio: Number,
            categoria: String
        },
        cantidad: Number
    }],
    total: Number,
    pdf_url: String,
    estado: { type: String, enum: ['pagada', 'pendiente', 'cancelada'], default: 'pagada' },
    folio: { type: String, unique: true },
    fecha: { type: Date, default: Date.now }
});
const Venta = mongoose.model('Venta', VentaSchema);

// --- FUNCIÓN GENERAR Y SUBIR PDF ---
const generarYSubirPDF = async (ventaData, ventaId) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', async () => {
            const pdfData = Buffer.concat(buffers);
            const params = {
                Bucket: S3_BUCKET_NAME,
                Key: `notas_venta/nota_${ventaId}.pdf`,
                Body: pdfData,
                ContentType: 'application/pdf',
            };
            try {
                const stored = await s3.upload(params).promise();
                resolve(stored.Location);
            } catch (e) {
                reject(e);
            }
        });

        // DISEÑO DEL PDF
        doc.fontSize(20).text('NOTA DE VENTA', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`Folio: ${ventaData.folio || ventaId}`);

        doc.text(`Cliente: ${ventaData.cliente_snapshot.nombre}`);
        doc.text(`RFC: ${ventaData.cliente_snapshot.rfc || 'XAXX010101000'}`);
        doc.text(`Fecha: ${new Date().toLocaleString()}`);
        doc.moveDown();
        
        doc.text('--- DETALLE ---');

        ventaData.items.forEach(item => {
            const nombre = item.snapshot.nombre;
            const precio = item.snapshot.precio;
            const subtotal = precio * item.cantidad;
            doc.text(`${nombre} x${item.cantidad} - $${subtotal}`);
        });
        doc.moveDown();
        doc.fontSize(16).text(`TOTAL: $${ventaData.total}`, { align: 'right' });
        
        doc.end();
    });
};

// --- ENDPOINT PRINCIPAL ---
app.post('/ventas', async (req, res) => {
    const start = Date.now(); // ⏱️ INICIO CRONÓMETRO
    
    try {
        const { cliente, productos, metodo_pago, direccion_entrega } = req.body;
        
        // Validaciones 
        const clienteData = await mongoose.connection.db.collection('clientes').findOne({ _id: new mongoose.Types.ObjectId(cliente) });
        if (!clienteData) throw new Error('Cliente no encontrado');

        const items = [];
        let total = 0;
        
        for (const p of productos) {
            const prodData = await mongoose.connection.db.collection('productos').findOne({ _id: new mongoose.Types.ObjectId(p.producto) });
            if (!prodData) throw new Error(`Producto no encontrado: ${p.producto}`);
            if (prodData.stock < p.cantidad) throw new Error(`Stock insuficiente para ${prodData.nombre}`);
            
            items.push({
                producto: prodData._id,
                snapshot: {
                    nombre: prodData.nombre,
                    descripcion: prodData.descripcion,
                    precio: prodData.precio,
                    categoria: prodData.categoria
                },
                cantidad: p.cantidad
            });
            total += prodData.precio * p.cantidad;
        }

        // Actualizar stock
        for (const p of productos) {
            await mongoose.connection.db.collection('productos').updateOne(
                { _id: new mongoose.Types.ObjectId(p.producto) },
                { $inc: { stock: -p.cantidad } }
            );
        }

        // 3. Crear Folio
        const nuevaVentaId = new mongoose.Types.ObjectId();
        const folio = `VENTA-${nuevaVentaId.toString().slice(-6).toUpperCase()}`;

        // 4. Preparar datos para PDF
        const ventaSnapshot = {
            folio, // Pasamos el folio al PDF
            cliente_snapshot: {
                nombre: clienteData.nombre,
                email: clienteData.email,
                telefono: clienteData.telefono,
                rfc: clienteData.rfc || 'Generico',
                direccion: clienteData.direccion
            },
            items,
            total
        };

        // 5. Generar PDF
        console.log("Generando PDF");
        const urlPDF = await generarYSubirPDF(ventaSnapshot, nuevaVentaId);

        // 6. Guardar Venta
        const ventaGuardada = await Venta.create({
            _id: nuevaVentaId,
            cliente: clienteData._id,
            ...ventaSnapshot,
            pdf_url: urlPDF,
            estado: 'pagada',
            metodo_pago,
            direccion_entrega,
            folio
        });

        // 7. Notificación SNS
        await sns.publish({
            TopicArn: SNS_TOPIC_ARN,
            Subject: `Nueva Compra Confirmada - ${folio}`,
            Message: `Hola ${clienteData.nombre},\n\nGracias por tu compra.\nDescarga tu nota:\n${urlPDF}\n\nTotal: $${total}`
        }).promise();

        // --- MÉTRICAS DE ÉXITO ---
        const duration = Date.now() - start;
        // Métrica de tiempo (para percentiles)
        await logMetric("TiempoEjecucion", duration, "Milliseconds", { Endpoint: "/ventas" });
        // Métrica de éxito HTTP (para rangos)
        await logMetric("RequestCount", 1, "Count", { Status: "2xx" });

        res.status(201).json({ 
            status: "Venta Exitosa", 
            pdf: urlPDF,
            id: ventaGuardada._id,
            folio
        });

    } catch (error) {
        console.error("Error en venta:", error.message);
        
        // --- MÉTRICAS DE ERROR ---
        const duration = Date.now() - start;
        await logMetric("TiempoEjecucion", duration, "Milliseconds", { Endpoint: "/ventas" });
        await logMetric("RequestCount", 1, "Count", { Status: "5xx" }); // Marcamos como 5xx

        // Devolvemos error al cliente
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sales Service running on ${PORT}`));