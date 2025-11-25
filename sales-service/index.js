const express = require('express');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit'); // Librería PDF
const { logMetric, Unit } = require('./metrics');
require('dotenv').config();

const app = express();
app.use(express.json());

// CONFIGURACIÓN
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN; // El ARN que copiaste
const MONGO_URI = process.env.MONGO_URI;

AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const s3 = new AWS.S3();
const sns = new AWS.SNS();

mongoose.connect(MONGO_URI).then(() => console.log('DB Conectada'));

// MODELO COMPLETO (Relación por Referencia + Snapshot)
const VentaSchema = new mongoose.Schema({
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true }, // Referencia real
    cliente_snapshot: {
        nombre: String,
        email: String,
        telefono: String,
        rfc: String,
        direccion: String
    },
    items: [{
        producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true }, // Referencia real
        snapshot: {
            nombre: String,
            descripcion: String,
            precio: Number,
            categoria: String
        },
        cantidad: Number
    }],
    total: Number,
    pdf_url: String,         // Aquí guardaremos el link del PDF
    estado: { type: String, enum: ['pagada', 'pendiente', 'cancelada'], default: 'pagada' },
    metodo_pago: String,
    direccion_entrega: String,
    folio: { type: String, unique: true },
    fecha: { type: Date, default: Date.now }
});
const Venta = mongoose.model('Venta', VentaSchema);

// --- FUNCIÓN GENERAR Y SUBIR PDF ---
const generarYSubirPDF = async (ventaData, ventaId) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const buffers = [];

        // 1. Guardar datos en buffer en lugar de archivo local
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', async () => {
            const pdfData = Buffer.concat(buffers);
            
            // 2. Subir a S3
            const params = {
                Bucket: S3_BUCKET_NAME,
                Key: `notas_venta/nota_${ventaId}.pdf`, // Nombre del archivo
                Body: pdfData,
                ContentType: 'application/pdf',
                // ACL: 'public-read' // Descomentar si tu bucket lo requiere explícitamente
            };

            try {
                // Usamos upload() de AWS SDK
                const stored = await s3.upload(params).promise();
                resolve(stored.Location); // Devuelve la URL pública
            } catch (e) {
                reject(e);
            }
        });

        // 3. Diseñar el PDF
        doc.fontSize(20).text('NOTA DE VENTA', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`Folio: ${ventaId}`);
        doc.text(`Cliente: ${ventaData.cliente_nombre}`);
        doc.text(`Fecha: ${new Date().toLocaleString()}`);
        doc.moveDown();
        
        doc.text('--- DETALLE ---');
        ventaData.items.forEach(item => {
            doc.text(`${item.nombre} x${item.cantidad} - $${item.precio * item.cantidad}`);
        });
        doc.moveDown();
        doc.fontSize(16).text(`TOTAL: $${ventaData.total}`, { align: 'right' });
        
        doc.end(); // Finaliza el PDF
    });
};

// Nuevo endpoint: recibe { cliente: id, productos: [{ producto: id, cantidad }] }
app.post('/ventas', async (req, res) => {
    try {
        const { cliente, productos, metodo_pago, direccion_entrega } = req.body;
        // 1. Buscar cliente
        const clienteData = await mongoose.connection.db.collection('clientes').findOne({ _id: new mongoose.Types.ObjectId(cliente) });
        if (!clienteData) return res.status(400).json({ error: 'Cliente no encontrado' });

        // 2. Buscar productos y armar items
        const items = [];
        let total = 0;
        for (const p of productos) {
            const prodData = await mongoose.connection.db.collection('productos').findOne({ _id: new mongoose.Types.ObjectId(p.producto) });
            if (!prodData) return res.status(400).json({ error: `Producto no encontrado: ${p.producto}` });
            if (prodData.stock < p.cantidad) return res.status(400).json({ error: `Stock insuficiente para ${prodData.nombre}` });
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

        // 3. Actualizar stock
        for (const p of productos) {
            await mongoose.connection.db.collection('productos').updateOne(
                { _id: new mongoose.Types.ObjectId(p.producto) },
                { $inc: { stock: -p.cantidad } }
            );
        }

        // 4. Crear ID preliminar y folio
        const nuevaVentaId = new mongoose.Types.ObjectId();
        const folio = `VENTA-${nuevaVentaId.toString().slice(-6).toUpperCase()}`;

        // 5. Generar PDF y Subir a S3
        const ventaSnapshot = {
            cliente_snapshot: {
                nombre: clienteData.nombre,
                email: clienteData.email,
                telefono: clienteData.telefono,
                rfc: clienteData.rfc,
                direccion: clienteData.direccion
            },
            items,
            total
        };
        const urlPDF = await generarYSubirPDF(ventaSnapshot, nuevaVentaId);

        // 6. Guardar en Mongo
        const ventaGuardada = await Venta.create({
            _id: nuevaVentaId,
            cliente: clienteData._id,
            cliente_snapshot: ventaSnapshot.cliente_snapshot,
            items,
            total,
            pdf_url: urlPDF,
            estado: 'pagada',
            metodo_pago,
            direccion_entrega,
            folio
        });

        // 7. Enviar Notificación via SNS
        await sns.publish({
            TopicArn: SNS_TOPIC_ARN,
            Subject: `Nueva Compra Confirmada - Folio ${folio}`,
            Message: `Hola ${clienteData.nombre},\n\nGracias por tu compra.\n\nPuedes descargar tu nota de venta aquí:\n${urlPDF}\n\nTotal: $${total}`
        }).promise();

        await logMetric("VentasExitosas", 1, Unit.Count);

        res.status(201).json({ 
            status: "Venta Exitosa", 
            pdf: urlPDF,
            id: ventaGuardada._id,
            folio,
            total
        });
    } catch (error) {
        console.error(error);
        await logMetric("ErroresVenta", 1, Unit.Count);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sales Service con PDF running on ${PORT}`));