import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../VYNEHR/.env') });

const app = express();
const PORT = process.env.BACKOFFICE_PORT || 4000;

// Contraseña de acceso al backoffice
// En producción, configurar BACKOFFICE_PASSWORD como variable de entorno en Render.com
const BACKOFFICE_PASSWORD = process.env.BACKOFFICE_PASSWORD || '5r2fUIhBPbuC';

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Ruta raíz - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Rutas de autenticación (deben estar antes del middleware de autenticación)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Contraseña requerida' });
        }
        
        if (password === BACKOFFICE_PASSWORD) {
            // Generar token simple (en producción usar JWT)
            res.json({ 
                success: true, 
                token: BACKOFFICE_PASSWORD,
                message: 'Autenticación exitosa' 
            });
        } else {
            res.status(401).json({ error: 'Contraseña incorrecta' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/auth/verify', async (req, res) => {
    try {
        const token = req.headers['authorization'];
        
        if (token && token === `Bearer ${BACKOFFICE_PASSWORD}`) {
            res.json({ valid: true });
        } else {
            res.status(401).json({ valid: false });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Middleware de autenticación para rutas API (excepto login)
const requireAuth = (req, res, next) => {
    // Permitir acceso a archivos estáticos y la ruta raíz
    if (!req.path.startsWith('/api/')) {
        return next();
    }
    
    // Permitir acceso a rutas de autenticación
    if (req.path === '/api/auth/login' || req.path === '/api/auth/verify') {
        return next();
    }
    
    // Verificar token para otras rutas API
    const token = req.headers['authorization'];
    if (!token || token !== `Bearer ${BACKOFFICE_PASSWORD}`) {
        return res.status(401).json({ error: 'No autorizado. Token inválido o faltante.' });
    }
    
    next();
};

// Aplicar middleware de autenticación
app.use(requireAuth);

// Conexión a MongoDB
// IMPORTANTE: En producción, configurar MONGODB_URI como variable de entorno en Render.com
// Para producción: usar base de datos de producción
// Para desarrollo: usar base de datos de desarrollo
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI no está configurada. Por favor, configura esta variable de entorno en Render.com');
    process.exit(1);
}

mongoose.connect(MONGODB_URI, {
    dbName: 'vynehr',
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
    },
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    retryWrites: true,
    retryReads: true
})
.then(() => {
    console.log('✅ MongoDB conectado al backoffice');
})
.catch(err => {
    console.error('❌ Error MongoDB:', err.message);
    process.exit(1);
});

// Usamos directamente las colecciones de MongoDB sin necesidad de importar modelos

// Función helper para obtener estadísticas de colección
const getCollectionStats = async (collectionName) => {
    try {
        const db = mongoose.connection.db;
        const stats = await db.collection(collectionName).stats();
        const count = await db.collection(collectionName).countDocuments();
        return {
            count,
            size: stats.size,
            avgObjSize: stats.avgObjSize,
            storageSize: stats.storageSize,
            indexes: stats.nindexes,
            totalIndexSize: stats.totalIndexSize
        };
    } catch (error) {
        return { error: error.message };
    }
};

// Ruta principal - información de todas las colecciones
app.get('/api/collections', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        const collectionsInfo = await Promise.all(
            collections.map(async (col) => {
                const stats = await getCollectionStats(col.name);
                return {
                    name: col.name,
                    ...stats
                };
            })
        );
        
        res.json(collectionsInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para obtener datos de una colección específica
app.get('/api/collections/:collectionName', async (req, res) => {
    try {
        const { collectionName } = req.params;
        const { page = 1, limit = 50, search = '', sortBy = '_id', sortOrder = 'desc' } = req.query;
        
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        // Construir query de búsqueda
        let query = {};
        if (search) {
            // Búsqueda simple en todos los campos string
            // Para colecciones específicas, podemos hacer búsqueda más inteligente
            const sampleDoc = await collection.findOne({});
            if (sampleDoc) {
                const stringFields = Object.keys(sampleDoc).filter(key => 
                    typeof sampleDoc[key] === 'string'
                );
                if (stringFields.length > 0) {
                    query = { 
                        $or: stringFields.map(field => ({ 
                            [field]: { $regex: search, $options: 'i' } 
                        }))
                    };
                }
            }
        }
        
        // Calcular paginación
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        
        // Obtener datos
        const [data, total] = await Promise.all([
            collection.find(query).sort(sort).skip(skip).limit(parseInt(limit)).toArray(),
            collection.countDocuments(query)
        ]);
        
        res.json({
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para obtener un documento específico
app.get('/api/collections/:collectionName/:id', async (req, res) => {
    try {
        const { collectionName, id } = req.params;
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        const document = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
        
        if (!document) {
            return res.status(404).json({ error: 'Documento no encontrado' });
        }
        
        res.json(document);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para buscar en todas las colecciones
app.get('/api/search', async (req, res) => {
    try {
        const { q, collection } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }
        
        const db = mongoose.connection.db;
        const collections = collection 
            ? [collection]
            : (await db.listCollections().toArray()).map(c => c.name);
        
        const results = await Promise.all(
            collections.map(async (colName) => {
                try {
                    const col = db.collection(colName);
                    // Obtener un documento de muestra para conocer los campos
                    const sampleDoc = await col.findOne({});
                    if (!sampleDoc) {
                        return { collection: colName, count: 0, results: [] };
                    }
                    
                    const stringFields = Object.keys(sampleDoc).filter(key => 
                        typeof sampleDoc[key] === 'string'
                    );
                    
                    let searchQuery = {};
                    if (stringFields.length > 0) {
                        searchQuery = {
                            $or: stringFields.map(field => ({ 
                                [field]: { $regex: q, $options: 'i' } 
                            }))
                        };
                    }
                    
                    const matches = await col.find(searchQuery).limit(10).toArray();
                    
                    return {
                        collection: colName,
                        count: matches.length,
                        results: matches
                    };
                } catch (error) {
                    return {
                        collection: colName,
                        count: 0,
                        error: error.message,
                        results: []
                    };
                }
            })
        );
        
        res.json({ query: q, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para obtener estadísticas de la base de datos
app.get('/api/stats', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        const stats = await Promise.all(
            collections.map(async (col) => {
                const collectionStats = await getCollectionStats(col.name);
                return {
                    name: col.name,
                    ...collectionStats
                };
            })
        );
        
        const dbStats = await db.stats();
        
        res.json({
            database: {
                name: db.databaseName,
                collections: collections.length,
                dataSize: dbStats.dataSize,
                storageSize: dbStats.storageSize,
                indexSize: dbStats.indexSize
            },
            collections: stats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para GridFS - obtener lista de archivos
app.get('/api/gridfs/files', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'cvs' });
        
        const files = [];
        const cursor = bucket.find({});
        
        for await (const file of cursor) {
            files.push({
                _id: file._id,
                filename: file.filename,
                length: file.length,
                chunkSize: file.chunkSize,
                uploadDate: file.uploadDate,
                contentType: file.contentType,
                metadata: file.metadata
            });
        }
        
        res.json({ files, count: files.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para descargar archivo de GridFS
app.get('/api/gridfs/files/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = mongoose.connection.db;
        const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'cvs' });
        
        const file = await bucket.find({ _id: new mongoose.Types.ObjectId(id) }).next();
        
        if (!file) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        
        const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(id));
        downloadStream.pipe(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Backoffice server iniciado en http://localhost:${PORT}`);
});

