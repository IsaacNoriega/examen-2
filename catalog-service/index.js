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
        const { nombre, email, telefono, rfc, direccion } = req.body;
        if (!nombre || !email) {
            return res.status(400).json({ error: 'El nombre y el email son obligatorios.' });
        }
        const c = await Cliente.create({ nombre, email, telefono, rfc, direccion });
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
        if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(cliente);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Actualizar
app.put('/clientes/:id', async (req, res) => {
    try {
        const { nombre, email, telefono, rfc, direccion } = req.body;
        if (nombre === '' || email === '') {
            return res.status(400).json({ error: 'El nombre y el email no pueden estar vacíos.' });
        }
        const update = {};
        if (nombre !== undefined) update.nombre = nombre;
        if (email !== undefined) update.email = email;
        if (telefono !== undefined) update.telefono = telefono;
        if (rfc !== undefined) update.rfc = rfc;
        if (direccion !== undefined) update.direccion = direccion;
        const cliente = await Cliente.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!cliente) return res.status(404).json({ error: 'No se encontró el cliente para actualizar.' });
        res.json(cliente);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Eliminar
app.delete('/clientes/:id', async (req, res) => {
    try {
        const cliente = await Cliente.findByIdAndDelete(req.params.id);
        if (!cliente) return res.status(404).json({ error: 'No se encontró el cliente para eliminar.' });
        res.json({ eliminado: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crear
app.post('/productos', async (req, res) => {
    try {
        const { nombre, precio, stock, descripcion, categoria, imagen, activo } = req.body;
        if (!nombre || precio === undefined || stock === undefined) {
            return res.status(400).json({ error: 'El nombre, precio y stock son obligatorios.' });
        }
        if (typeof precio !== 'number' || typeof stock !== 'number') {
            return res.status(400).json({ error: 'El precio y el stock deben ser números.' });
        }
        const p = await Producto.create({ nombre, precio, stock, descripcion, categoria, imagen, activo });
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
        const { nombre, precio, stock, descripcion, categoria, imagen, activo } = req.body;
        if (nombre === '') {
            return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
        }
        if (precio !== undefined && typeof precio !== 'number') {
            return res.status(400).json({ error: 'El precio debe ser un número.' });
        }
        if (stock !== undefined && typeof stock !== 'number') {
            return res.status(400).json({ error: 'El stock debe ser un número.' });
        }
        const update = {};
        if (nombre !== undefined) update.nombre = nombre;
        if (precio !== undefined) update.precio = precio;
        if (stock !== undefined) update.stock = stock;
        if (descripcion !== undefined) update.descripcion = descripcion;
        if (categoria !== undefined) update.categoria = categoria;
        if (imagen !== undefined) update.imagen = imagen;
        if (activo !== undefined) update.activo = activo;
        const producto = await Producto.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!producto) return res.status(404).json({ error: 'No se encontró el producto para actualizar.' });
        res.json(producto);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Eliminar
app.delete('/productos/:id', async (req, res) => {
    try {
        const producto = await Producto.findByIdAndDelete(req.params.id);
        if (!producto) return res.status(404).json({ error: 'No se encontró el producto para eliminar.' });
        res.json({ eliminado: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Catalogos en ${PORT}` ));