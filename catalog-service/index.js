const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// Esquemas 
const ClienteSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    email: { type: String, required: true },
    telefono: String,
    rfc: String,
    direccion: String, 
    fecha_registro: { type: Date, default: Date.now }
});

const ProductoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    descripcion: String,
    precio: { type: Number, required: true },
    stock: { type: Number, required: true },
    categoria: String,
    imagen: String,
    activo: { type: Boolean, default: true },
    fecha_alta: { type: Date, default: Date.now }
});

const Cliente = mongoose.model('Cliente', ClienteSchema);
const Producto = mongoose.model('Producto', ProductoSchema);


// Crear
app.post('/clientes', async (req, res) => {
    try {
        const c = await Cliente.create(req.body);
        res.json(c);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Listar todos
app.get('/clientes', async (req, res) => {
    try {
        const clientes = await Cliente.find();
        res.json(clientes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Obtener uno
app.get('/clientes/:id', async (req, res) => {
    try {
        const cliente = await Cliente.findById(req.params.id);
        if (!cliente) return res.status(404).json({ error: 'No encontrado' });
        res.json(cliente);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Actualizar
app.put('/clientes/:id', async (req, res) => {
    try {
        const cliente = await Cliente.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!cliente) return res.status(404).json({ error: 'No encontrado' });
        res.json(cliente);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Eliminar
app.delete('/clientes/:id', async (req, res) => {
    try {
        const cliente = await Cliente.findByIdAndDelete(req.params.id);
        if (!cliente) return res.status(404).json({ error: 'No encontrado' });
        res.json({ eliminado: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crear
app.post('/productos', async (req, res) => {
    try {
        const p = await Producto.create(req.body);
        res.json(p);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Listar todos
app.get('/productos', async (req, res) => {
    try {
        const productos = await Producto.find();
        res.json(productos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Obtener uno
app.get('/productos/:id', async (req, res) => {
    try {
        const producto = await Producto.findById(req.params.id);
        if (!producto) return res.status(404).json({ error: 'No encontrado' });
        res.json(producto);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Actualizar
app.put('/productos/:id', async (req, res) => {
    try {
        const producto = await Producto.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!producto) return res.status(404).json({ error: 'No encontrado' });
        res.json(producto);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Eliminar
app.delete('/productos/:id', async (req, res) => {
    try {
        const producto = await Producto.findByIdAndDelete(req.params.id);
        if (!producto) return res.status(404).json({ error: 'No encontrado' });
        res.json({ eliminado: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Catalogos en ${PORT}` ));