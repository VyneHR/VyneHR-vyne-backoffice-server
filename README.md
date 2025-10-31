# VYNE HR Database Visualizer - Backoffice

Visualizador completo de la base de datos MongoDB de VYNE HR. Interfaz moderna y funcional para explorar todas las colecciones, documentos y archivos GridFS.

## 🚀 Características

- ✅ Visualización de todas las colecciones de MongoDB
- ✅ Estadísticas en tiempo real de la base de datos
- ✅ Búsqueda avanzada en todas las colecciones
- ✅ Paginación y ordenamiento de resultados
- ✅ Visualización detallada de documentos JSON
- ✅ Soporte para GridFS (archivos CV)
- ✅ Interfaz moderna y responsive
- ✅ Conexión automática a la base de datos

## 📋 Requisitos

- Node.js 18+ 
- MongoDB (local o remoto)
- Acceso a la base de datos `vynehr`

## 🔧 Instalación

1. **Instalar dependencias:**
```bash
cd VYNE-BACKOFFICE
npm install
```

2. **Configurar variables de entorno (opcional):**

El backoffice intentará usar las mismas variables de entorno del proyecto principal. Si necesitas configurarlas específicamente, crea un archivo `.env` en la raíz de `VYNE-BACKOFFICE`:

```env
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/vynehr?retryWrites=true&w=majority
BACKOFFICE_PORT=4000
```

O el backoffice usará la configuración por defecto del proyecto principal desde `../VYNEHR/.env`.

## 🎯 Uso

1. **Iniciar el servidor:**
```bash
npm start
```

El servidor se iniciará en `http://localhost:4000`

2. **Abrir en el navegador:**
```
http://localhost:4000
```

## 📖 API Endpoints

### GET `/api/collections`
Obtiene lista de todas las colecciones con estadísticas.

### GET `/api/collections/:collectionName`
Obtiene documentos de una colección específica.

**Query Parameters:**
- `page` (default: 1): Número de página
- `limit` (default: 50): Documentos por página
- `search` (opcional): Búsqueda en campos string
- `sortBy` (default: _id): Campo para ordenar
- `sortOrder` (default: desc): Orden (asc/desc)

### GET `/api/collections/:collectionName/:id`
Obtiene un documento específico por ID.

### GET `/api/search?q=query&collection=name`
Búsqueda global en todas las colecciones o en una específica.

### GET `/api/stats`
Obtiene estadísticas generales de la base de datos.

### GET `/api/gridfs/files`
Obtiene lista de archivos almacenados en GridFS.

### GET `/api/gridfs/files/:id`
Descarga un archivo específico de GridFS.

## 🎨 Interfaz

### Dashboard Principal
- Estadísticas generales de la base de datos
- Lista de todas las colecciones con contadores
- Estado de conexión en tiempo real

### Visualizador de Colección
- Tabla con documentos paginados
- Búsqueda en tiempo real
- Ordenamiento por cualquier campo
- Vista detallada de documentos JSON

### Búsqueda Global
- Búsqueda simultánea en todas las colecciones
- Resultados agrupados por colección
- Resaltado de coincidencias

### GridFS Viewer
- Lista de archivos CV almacenados
- Información de metadatos
- Descarga directa de archivos

## 🔒 Seguridad

⚠️ **IMPORTANTE:** Este backoffice está diseñado para desarrollo y administración. En producción:

1. Agregar autenticación y autorización
2. Restringir acceso a la red (solo localhost o VPN)
3. Implementar rate limiting
4. Considerar usar un servidor proxy reverso
5. Validar y sanitizar todas las entradas

## 🛠️ Estructura del Proyecto

```
VYNE-BACKOFFICE/
├── backend/
│   └── server.js      # Servidor Express y API
├── frontend/
│   ├── index.html     # Interfaz principal
│   ├── styles.css     # Estilos
│   └── app.js         # Lógica del frontend
├── package.json       # Dependencias
└── README.md          # Documentación
```

## 📝 Notas

- El backoffice comparte la misma conexión MongoDB que el proyecto principal
- Usa directamente las colecciones de MongoDB sin pasar por los modelos Mongoose
- La búsqueda es case-insensitive en campos string
- Los documentos grandes se truncan en la vista de tabla

## 🐛 Solución de Problemas

### Error de conexión a MongoDB
- Verifica que MongoDB esté ejecutándose
- Comprueba las credenciales en `.env`
- Asegúrate de que el puerto no esté bloqueado por firewall

### Puerto ya en uso
- Cambia `BACKOFFICE_PORT` en `.env` o edita `server.js`

### No se muestran colecciones
- Verifica que la base de datos `vynehr` exista
- Comprueba los permisos del usuario de MongoDB

## 📞 Soporte

Para problemas o preguntas, consulta la documentación principal del proyecto VYNEHR.

---

**Versión:** 1.0.0  
**Última actualización:** 2025

