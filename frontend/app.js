// Configuración
// En producción, usar la URL del backend en Render
// En desarrollo local, usar la URL del servidor actual
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_BASE_URL = isProduction 
    ? 'https://vynehr-vyne-backoffice-server.onrender.com/api'
    : window.location.origin + '/api';
let currentCollection = null;
let currentPage = 1;
let currentSearch = '';
let currentSort = '_id:desc';
let currentLimit = 50;

// Estado de la aplicación
const state = {
    collections: [],
    stats: null,
    currentData: null
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    await checkConnection();
    await loadStats();
    await loadCollections();
});

// Verificar conexión
async function checkConnection() {
    const statusEl = document.getElementById('connectionStatus');
    const statusDot = statusEl.querySelector('.status-dot');
    const statusText = statusEl.querySelector('span:last-child');
    
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        if (response.ok) {
            statusDot.classList.add('connected');
            statusText.textContent = 'Conectado';
        } else {
            throw new Error('Error de conexión');
        }
    } catch (error) {
        statusDot.classList.add('error');
        statusText.textContent = 'Error de conexión';
    }
}

// Cargar estadísticas
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        const data = await response.json();
        state.stats = data;
        renderStats(data);
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

function renderStats(stats) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = '';
    
    // Estadísticas generales
    const dbStats = [
        {
            title: 'Base de Datos',
            value: stats.database.name,
            subtitle: `${stats.database.collections} colecciones`
        },
        {
            title: 'Tamaño de Datos',
            value: formatBytes(stats.database.dataSize),
            subtitle: 'Almacenamiento'
        },
        {
            title: 'Índices',
            value: formatBytes(stats.database.indexSize),
            subtitle: 'Tamaño de índices'
        },
        {
            title: 'Total Almacenamiento',
            value: formatBytes(stats.database.storageSize),
            subtitle: 'Espacio utilizado'
        }
    ];
    
    dbStats.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <h3>${stat.title}</h3>
            <div class="value">${stat.value}</div>
            <div class="subtitle">${stat.subtitle}</div>
        `;
        statsGrid.appendChild(card);
    });
    
    // Estadísticas por colección
    stats.collections.forEach(collection => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <h3>${collection.name}</h3>
            <div class="value">${collection.count || 0}</div>
            <div class="subtitle">${formatBytes(collection.size || 0)}</div>
        `;
        statsGrid.appendChild(card);
    });
}

// Cargar colecciones
async function loadCollections() {
    try {
        const response = await fetch(`${API_BASE_URL}/collections`);
        const collections = await response.json();
        state.collections = collections;
        renderCollections(collections);
    } catch (error) {
        console.error('Error cargando colecciones:', error);
    }
}

function renderCollections(collections) {
    const collectionsGrid = document.getElementById('collectionsGrid');
    collectionsGrid.innerHTML = '';
    
    // Filtrar colecciones de GridFS (solo mostrar las principales)
    const mainCollections = collections.filter(col => 
        !col.name.includes('.') && col.name !== 'cvs.chunks'
    );
    
    mainCollections.forEach(collection => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.onclick = () => openCollection(collection.name);
        
        card.innerHTML = `
            <h3>${collection.name}</h3>
            <div class="count">${collection.count || 0}</div>
            <div class="meta">
                <span>${formatBytes(collection.size || 0)}</span>
                <span>${collection.indexes || 0} índices</span>
            </div>
        `;
        
        collectionsGrid.appendChild(card);
    });
    
    // Agregar card especial para GridFS
    const gridfsCollection = collections.find(col => col.name === 'cvs.files');
    if (gridfsCollection) {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.onclick = () => openGridFS();
        
        card.innerHTML = `
            <h3>📁 GridFS (CVs)</h3>
            <div class="count">${gridfsCollection.count || 0}</div>
            <div class="meta">
                <span>Archivos almacenados</span>
            </div>
        `;
        
        collectionsGrid.appendChild(card);
    }
}

// Abrir colección
function openCollection(collectionName) {
    currentCollection = collectionName;
    currentPage = 1;
    currentSearch = '';
    
    const modal = document.getElementById('collectionModal');
    const modalTitle = document.getElementById('modalTitle');
    modalTitle.textContent = `Colección: ${collectionName}`;
    
    document.getElementById('searchInput').value = '';
    document.getElementById('sortSelect').value = '_id:desc';
    document.getElementById('limitSelect').value = '50';
    
    modal.classList.add('active');
    loadCollection();
}

// Cargar datos de colección
async function loadCollection() {
    if (!currentCollection) return;
    
    const loading = document.getElementById('loading');
    const container = document.getElementById('collectionTableContainer');
    const pagination = document.getElementById('pagination');
    
    loading.style.display = 'block';
    container.innerHTML = '';
    pagination.innerHTML = '';
    
    try {
        currentSearch = document.getElementById('searchInput').value;
        currentSort = document.getElementById('sortSelect').value;
        currentLimit = parseInt(document.getElementById('limitSelect').value);
        
        const [sortBy, sortOrder] = currentSort.split(':');
        
        const url = `${API_BASE_URL}/collections/${currentCollection}?` +
            `page=${currentPage}&limit=${currentLimit}&sortBy=${sortBy}&sortOrder=${sortOrder}` +
            (currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : '');
        
        const response = await fetch(url);
        const data = await response.json();
        
        state.currentData = data;
        loading.style.display = 'none';
        renderCollectionTable(data.data);
        renderPagination(data.pagination);
    } catch (error) {
        loading.style.display = 'none';
        container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
        console.error('Error cargando colección:', error);
    }
}

// Renderizar tabla de colección
function renderCollectionTable(data) {
    if (!data || data.length === 0) {
        document.getElementById('collectionTableContainer').innerHTML = 
            '<div class="empty-state">No hay documentos en esta colección</div>';
        return;
    }
    
    // Obtener todas las claves únicas de todos los documentos
    const allKeys = new Set();
    data.forEach(doc => {
        Object.keys(doc).forEach(key => allKeys.add(key));
    });
    
    const keys = Array.from(allKeys).slice(0, 10); // Limitar a 10 columnas
    
    const table = document.createElement('table');
    table.className = 'collection-table';
    
    // Headers
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    keys.forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        headerRow.appendChild(th);
    });
    if (keys.length < allKeys.size) {
        const th = document.createElement('th');
        th.textContent = `... (+${allKeys.size - keys.length} más)`;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    data.forEach(doc => {
        const row = document.createElement('tr');
        keys.forEach(key => {
            const td = document.createElement('td');
            td.className = 'cell-content';
            td.appendChild(renderCell(doc[key], key));
            row.appendChild(td);
        });
        if (keys.length < allKeys.size) {
            const td = document.createElement('td');
            td.textContent = 'Ver detalles...';
            td.style.cursor = 'pointer';
            td.style.color = 'var(--primary-color)';
            td.onclick = () => viewDocument(doc);
            row.appendChild(td);
        }
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    document.getElementById('collectionTableContainer').innerHTML = '';
    document.getElementById('collectionTableContainer').appendChild(table);
}

// Renderizar celda
function renderCell(value, key) {
    const span = document.createElement('span');
    
    if (value === null || value === undefined) {
        span.textContent = 'null';
        span.style.color = 'var(--text-secondary)';
        span.style.fontStyle = 'italic';
    } else if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value))) {
        span.className = 'cell-date';
        const date = new Date(value);
        span.textContent = date.toLocaleString('es-ES');
    } else if (typeof value === 'boolean') {
        span.className = `cell-boolean ${value}`;
        span.textContent = value ? 'true' : 'false';
    } else if (typeof value === 'object' && value.constructor === Object) {
        span.className = 'cell-object';
        span.textContent = `{${Object.keys(value).length} campos}`;
    } else if (Array.isArray(value)) {
        span.className = 'cell-array';
        span.textContent = `[${value.length} elementos]`;
    } else if (typeof value === 'string' && value.match(/^[0-9a-fA-F]{24}$/)) {
        // ObjectId de MongoDB
        span.className = 'cell-id';
        span.textContent = value;
        span.title = 'Click para ver detalles';
        span.style.cursor = 'pointer';
    } else {
        span.textContent = String(value).substring(0, 100);
        if (String(value).length > 100) {
            span.textContent += '...';
        }
    }
    
    return span;
}

// Renderizar paginación
function renderPagination(pagination) {
    const paginationEl = document.getElementById('pagination');
    paginationEl.innerHTML = '';
    
    if (pagination.pages <= 1) return;
    
    const pageInfo = document.createElement('div');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Página ${pagination.page} de ${pagination.pages} (${pagination.total} total)`;
    paginationEl.appendChild(pageInfo);
    
    // Botón anterior
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Anterior';
    prevBtn.disabled = pagination.page === 1;
    prevBtn.onclick = () => {
        if (pagination.page > 1) {
            currentPage = pagination.page - 1;
            loadCollection();
        }
    };
    paginationEl.appendChild(prevBtn);
    
    // Botón siguiente
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Siguiente →';
    nextBtn.disabled = pagination.page === pagination.pages;
    nextBtn.onclick = () => {
        if (pagination.page < pagination.pages) {
            currentPage = pagination.page + 1;
            loadCollection();
        }
    };
    paginationEl.appendChild(nextBtn);
}

// Ver documento completo
function viewDocument(doc) {
    const modal = document.getElementById('documentModal');
    const content = document.getElementById('documentContent');
    content.textContent = JSON.stringify(doc, null, 2);
    modal.classList.add('active');
}

// Cerrar modales
function closeModal() {
    document.getElementById('collectionModal').classList.remove('active');
    currentCollection = null;
}

function closeDocumentModal() {
    document.getElementById('documentModal').classList.remove('active');
}

// Handlers
function handleSearch(event) {
    if (event.key === 'Enter') {
        currentPage = 1;
        loadCollection();
    }
}

function handleGlobalSearch(event) {
    if (event.key === 'Enter') {
        performGlobalSearch();
    }
}

// Búsqueda global
async function performGlobalSearch() {
    const query = document.getElementById('globalSearch').value;
    if (!query) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        // Crear modal de resultados
        const modal = document.getElementById('collectionModal');
        const modalTitle = document.getElementById('modalTitle');
        modalTitle.textContent = `Resultados de búsqueda: "${query}"`;
        
        const container = document.getElementById('collectionTableContainer');
        container.innerHTML = '';
        
        data.results.forEach(result => {
            if (result.count > 0) {
                const section = document.createElement('div');
                section.style.marginBottom = '2rem';
                section.innerHTML = `
                    <h3 style="margin-bottom: 1rem; color: var(--primary-color);">
                        ${result.collection} (${result.count} resultados)
                    </h3>
                `;
                
                const table = document.createElement('table');
                table.className = 'collection-table';
                
                if (result.results.length > 0) {
                    const keys = Object.keys(result.results[0]).slice(0, 5);
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    keys.forEach(key => {
                        const th = document.createElement('th');
                        th.textContent = key;
                        headerRow.appendChild(th);
                    });
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                    
                    const tbody = document.createElement('tbody');
                    result.results.forEach(doc => {
                        const row = document.createElement('tr');
                        keys.forEach(key => {
                            const td = document.createElement('td');
                            td.appendChild(renderCell(doc[key], key));
                            row.appendChild(td);
                        });
                        tbody.appendChild(row);
                    });
                    table.appendChild(tbody);
                }
                
                section.appendChild(table);
                container.appendChild(section);
            }
        });
        
        modal.classList.add('active');
        document.getElementById('pagination').innerHTML = '';
    } catch (error) {
        console.error('Error en búsqueda global:', error);
        alert('Error realizando búsqueda: ' + error.message);
    }
}

// Abrir GridFS
async function openGridFS() {
    currentCollection = 'gridfs';
    
    const modal = document.getElementById('collectionModal');
    const modalTitle = document.getElementById('modalTitle');
    modalTitle.textContent = 'GridFS - Archivos CV';
    
    modal.classList.add('active');
    
    const loading = document.getElementById('loading');
    const container = document.getElementById('collectionTableContainer');
    const pagination = document.getElementById('pagination');
    
    loading.style.display = 'block';
    container.innerHTML = '';
    pagination.innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE_URL}/gridfs/files`);
        const data = await response.json();
        
        loading.style.display = 'none';
        
        if (data.files.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay archivos en GridFS</div>';
            return;
        }
        
        const table = document.createElement('table');
        table.className = 'collection-table';
        
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tamaño</th>
                <th>Fecha</th>
                <th>Candidato ID</th>
                <th>Acciones</th>
            </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        data.files.forEach(file => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="cell-id">${file._id}</td>
                <td>${file.filename}</td>
                <td>${formatBytes(file.length)}</td>
                <td class="cell-date">${new Date(file.uploadDate).toLocaleString('es-ES')}</td>
                <td>${file.metadata?.candidateId || 'N/A'}</td>
                <td>
                    <button class="btn btn-primary" onclick="downloadFile('${file._id}', '${file.filename}')">
                        📥 Descargar
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        container.appendChild(table);
    } catch (error) {
        loading.style.display = 'none';
        container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
    }
}

// Descargar archivo
function downloadFile(fileId, filename) {
    window.open(`${API_BASE_URL}/gridfs/files/${fileId}`, '_blank');
}

// Refrescar estadísticas
async function refreshStats() {
    await checkConnection();
    await loadStats();
    await loadCollections();
}

// Utilidades
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

