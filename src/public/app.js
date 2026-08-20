/*
  Live Dashboard WebSocket Client
  Handles WebSocket lifecycle, incoming event streams, metrics calculation, and DOM rendering.
*/

// Application State
const state = {
    attempts: [],
    stats: {
        total: 0,
        succeeded: 0,
        failed: 0,
        totalLatency: 0
    },
    maxLogSize: 100, // keep latest 100 entries to prevent DOM bloating
    filterStatus: 'ALL',
    searchQuery: ''
};

// DOM Elements
const elements = {
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    metricTotal: document.getElementById('metricTotal'),
    metricSuccess: document.getElementById('metricSuccess'),
    metricFailed: document.getElementById('metricFailed'),
    metricLatency: document.getElementById('metricLatency'),
    tableBody: document.getElementById('attemptsTableBody'),
    emptyRow: document.getElementById('emptyRow'),
    statusFilter: document.getElementById('statusFilter'),
    searchInput: document.getElementById('searchInput'),
    btnClear: document.getElementById('btnClear')
};

// Helper: Format Timestamp to HH:MM:SS
function formatTime(isoString) {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString();
}

// Helper: Get CSS class for HTTP response status code
function getCodeClass(code) {
    if (!code) return 'code-null';
    if (code >= 200 && code < 300) return 'code-2xx';
    if (code >= 400 && code < 500) return 'code-4xx';
    return 'code-5xx';
}

// Update dashboard summary metrics
function updateMetrics() {
    elements.metricTotal.textContent = state.stats.total;
    elements.metricSuccess.textContent = state.stats.succeeded;
    elements.metricFailed.textContent = state.stats.failed;

    const avgLatency = state.stats.total > 0
        ? Math.round(state.stats.totalLatency / state.stats.total)
        : 0;

    elements.metricLatency.textContent = `${avgLatency} ms`;
}

// Render a single attempt row element
function createTableRow(attempt, isNew = false) {
    const tr = document.createElement('tr');
    if (isNew) {
        tr.classList.add('row-new');
    }

    const statusBadgeClass = `badge-${attempt.status?.toLowerCase() || 'pending'}`;
    const codeClass = getCodeClass(attempt.responseCode || attempt.response_code);
    const displayCode = attempt.responseCode || attempt.response_code || '—';
    const displayLatency = attempt.latencyMs !== undefined ? `${attempt.latencyMs} ms` : (attempt.latency_ms !== undefined ? `${attempt.latency_ms} ms` : '—');
    const displayError = attempt.error || 'None';
    const attemptNumber = attempt.attemptNumber || attempt.attempt_number || 1;
    const eventId = attempt.eventId || attempt.event_id || '—';
    const createdAt = attempt.createdAt || attempt.created_at || new Date().toISOString();

    tr.innerHTML = `
        <td class="mono">${formatTime(createdAt)}</td>
        <td class="mono" title="${eventId}">${eventId.substring(0, 8)}...</td>
        <td class="mono">#${attemptNumber}</td>
        <td><span class="badge ${statusBadgeClass}">${attempt.status || 'unknown'}</span></td>
        <td class="status-code ${codeClass}">${displayCode}</td>
        <td class="mono">${displayLatency}</td>
        <td class="error-cell" title="${displayError}">${displayError}</td>
    `;

    return tr;
}

// Filter and re-render the whole table
function renderTable() {
    elements.tableBody.innerHTML = '';

    const filtered = state.attempts.filter((attempt) => {
        const matchesStatus = state.filterStatus === 'ALL' || attempt.status?.toLowerCase() === state.filterStatus.toLowerCase();
        const eventId = (attempt.eventId || attempt.event_id || '').toLowerCase();
        const matchesSearch = !state.searchQuery || eventId.includes(state.searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    if (filtered.length === 0) {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    ${state.attempts.length === 0 ? 'Waiting for webhook delivery attempts...' : 'No attempts match current filter.'}
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach((attempt) => {
        const row = createTableRow(attempt, false);
        elements.tableBody.appendChild(row);
    });
}

// Process an incoming attempt item
function handleIncomingAttempt(attempt) {
    // Update stats
    state.stats.total += 1;
    if (attempt.status === 'succeeded') {
        state.stats.succeeded += 1;
    } else if (attempt.status === 'failed' || attempt.status === 'exhausted') {
        state.stats.failed += 1;
    }

    const latency = Number(attempt.latencyMs || attempt.latency_ms) || 0;
    state.stats.totalLatency += latency;

    // Add to attempts array at the beginning
    state.attempts.unshift(attempt);
    if (state.attempts.length > state.maxLogSize) {
        state.attempts.pop();
    }

    updateMetrics();

    // Check if it passes current active filters
    const matchesStatus = state.filterStatus === 'ALL' || attempt.status?.toLowerCase() === state.filterStatus.toLowerCase();
    const eventId = (attempt.eventId || attempt.event_id || '').toLowerCase();
    const matchesSearch = !state.searchQuery || eventId.includes(state.searchQuery.toLowerCase());

    if (matchesStatus && matchesSearch) {
        // Remove empty state placeholder if present
        const emptyRow = elements.tableBody.querySelector('.empty-state');
        if (emptyRow) {
            elements.tableBody.innerHTML = '';
        }

        // Prepend new row with flash animation
        const newRow = createTableRow(attempt, true);
        elements.tableBody.insertBefore(newRow, elements.tableBody.firstChild);
    }
}

// WebSocket Connection Manager with auto-reconnect
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    elements.statusDot.className = 'status-dot connecting';
    elements.statusText.textContent = 'Connecting...';

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('[WebSocket] Connected to server');
        elements.statusDot.className = 'status-dot connected';
        elements.statusText.textContent = 'Live Connected';
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket] Received message:', data);

            // Handle delivery attempt event payload
            if (data.type === 'DELIVERY_ATTEMPT' && data.attempt) {
                handleIncomingAttempt(data.attempt);
            } else if (data.status && (data.eventId || data.event_id)) {
                // If the message is the attempt object itself
                handleIncomingAttempt(data);
            }
        } catch (err) {
            console.error('[WebSocket] Error parsing message:', err);
        }
    };

    ws.onclose = () => {
        console.warn('[WebSocket] Connection closed. Retrying in 3s...');
        elements.statusDot.className = 'status-dot';
        elements.statusText.textContent = 'Disconnected (Retrying)';
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        ws.close();
    };
}

// Event Listeners for Filters & Controls
elements.statusFilter.addEventListener('change', (e) => {
    state.filterStatus = e.target.value;
    renderTable();
});

elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    renderTable();
});

elements.btnClear.addEventListener('click', () => {
    state.attempts = [];
    state.stats = { total: 0, succeeded: 0, failed: 0, totalLatency: 0 };
    updateMetrics();
    renderTable();
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
});

// NEW: Fetch history using the REST API endpoints you built
const endpointIdInput = document.getElementById('endpointIdInput');
const btnLoadHistory = document.getElementById('btnLoadHistory');

btnLoadHistory.addEventListener('click', async () => {
    const endpointId = endpointIdInput.value.trim();
    if (!endpointId) {
        alert("Please enter an Endpoint ID");
        return;
    }

    try {
        btnLoadHistory.textContent = "Loading...";
        // Call your REST endpoint!
        const response = await fetch(`/endpoints/${endpointId}/attempts?limit=50`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || "Failed to load history");
        }

        // Clear current live state
        state.attempts = [];
        state.stats = { total: 0, succeeded: 0, failed: 0, totalLatency: 0 };

        // Process historical data
        if (data.attempts && data.attempts.length > 0) {
            // Reverse so we process oldest to newest (to match unshift logic)
            const historicalAttempts = data.attempts.reverse(); 
            historicalAttempts.forEach(attempt => {
                handleIncomingAttempt(attempt);
            });
        }
        
        renderTable();
        alert(`Loaded ${data.attempts ? data.attempts.length : 0} historical attempts!`);
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btnLoadHistory.textContent = "Load History";
    }
});