// ViralTenant Billing Dashboard - Admin Only
// Configuration
const CONFIG = {
    API_URL: 'https://ematolm790.execute-api.eu-central-1.amazonaws.com/production',
    COGNITO_REGION: 'eu-central-1',
    COGNITO_USER_POOL_ID: 'eu-central-1_4mUqVJrm2',
    COGNITO_CLIENT_ID: '23g1eol46sdr3a80prfem1kgli'
};

// State
let accessToken = null;
let idToken = null;
let currentUser = null;
let tenantsData = [];
let invoicesData = [];
let filteredTenants = [];
let filteredInvoices = [];
let filteredConsumption = [];
let awsCostsData = { currentMonth: { total: 0 }, previousMonth: { total: 0 } };

// Decode JWT token to get claims
function decodeJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Error decoding JWT:', e);
        return null;
    }
}

// Check if user is billing admin
function isBillingAdmin(token) {
    const decoded = decodeJwt(token);
    if (!decoded) return false;
    
    const groups = decoded['cognito:groups'] || [];
    console.log('User groups:', groups);
    return groups.includes('billing-admins');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for stored session
    const storedToken = localStorage.getItem('billingAccessToken');
    const storedIdToken = localStorage.getItem('billingIdToken');
    const storedUser = localStorage.getItem('billingUser');
    
    if (storedToken && storedUser && storedIdToken) {
        // Verify user is still billing admin
        if (!isBillingAdmin(storedIdToken)) {
            console.log('Stored user is not billing admin, clearing session');
            logout();
            return;
        }
        
        accessToken = storedToken;
        idToken = storedIdToken;
        currentUser = JSON.parse(storedUser);
        showDashboard();
        loadAllData();
    }
    
    // Login form handler
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

// Login Handler
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Anmelden...';
    errorDiv.classList.add('hidden');
    
    try {
        // Use Cognito InitiateAuth
        const response = await fetch(`https://cognito-idp.${CONFIG.COGNITO_REGION}.amazonaws.com/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-amz-json-1.1',
                'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
            },
            body: JSON.stringify({
                AuthFlow: 'USER_PASSWORD_AUTH',
                ClientId: CONFIG.COGNITO_CLIENT_ID,
                AuthParameters: {
                    USERNAME: email,
                    PASSWORD: password
                }
            })
        });
        
        const data = await response.json();
        
        if (data.AuthenticationResult) {
            const receivedIdToken = data.AuthenticationResult.IdToken;
            
            // Check if user is in billing-admins group
            if (!isBillingAdmin(receivedIdToken)) {
                throw new Error('Zugriff verweigert. Sie sind kein Billing-Administrator.');
            }
            
            accessToken = data.AuthenticationResult.AccessToken;
            idToken = receivedIdToken;
            currentUser = { email };
            
            // Store session
            localStorage.setItem('billingAccessToken', accessToken);
            localStorage.setItem('billingIdToken', idToken);
            localStorage.setItem('billingUser', JSON.stringify(currentUser));
            
            showDashboard();
            loadAllData();
        } else if (data.__type) {
            throw new Error(data.message || 'Anmeldung fehlgeschlagen');
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = error.message || 'Anmeldung fehlgeschlagen';
        errorDiv.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Anmelden';
    }
}

// Logout
function logout() {
    accessToken = null;
    idToken = null;
    currentUser = null;
    localStorage.removeItem('billingAccessToken');
    localStorage.removeItem('billingIdToken');
    localStorage.removeItem('billingUser');
    
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
}

// Show Dashboard
function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('userEmail').textContent = currentUser?.email || '';
}

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Creator-ID': 'platform'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${CONFIG.API_URL}${endpoint}`, options);
    
    if (response.status === 401) {
        logout();
        throw new Error('Session abgelaufen');
    }
    
    return response.json();
}

// Load All Data
async function loadAllData() {
    showLoading(true);
    
    try {
        await Promise.all([
            loadTenants(),
            loadAllInvoices(),
            loadAwsCosts()
        ]);
        
        updateStats();
        showTab('tenants');
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Fehler beim Laden der Daten: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Refresh Data
function refreshData() {
    loadAllData();
}

// Load Tenants
async function loadTenants() {
    try {
        const data = await apiCall('/billing/admin/tenants');
        tenantsData = data.tenants || [];
        filteredTenants = [...tenantsData];
        renderTenantsTable();
        renderConsumptionTable();
        populateInvoiceTenantFilter();
    } catch (error) {
        console.error('Error loading tenants:', error);
        // Fallback: Load from tenants endpoint
        try {
            const fallbackData = await apiCall('/tenants');
            tenantsData = (fallbackData || []).map(t => ({
                ...t,
                currentMonthTotal: 20,
                openInvoicesAmount: 0,
                paidTotal: 0
            }));
            filteredTenants = [...tenantsData];
            renderTenantsTable();
            renderConsumptionTable();
            populateInvoiceTenantFilter();
        } catch (e) {
            tenantsData = [];
            filteredTenants = [];
        }
    }
}

// Load All Invoices
async function loadAllInvoices() {
    try {
        const data = await apiCall('/billing/admin/invoices');
        invoicesData = data.invoices || [];
        filteredInvoices = [...invoicesData];
        renderInvoicesTable();
        populateInvoicePeriodFilter();
    } catch (error) {
        console.error('Error loading invoices:', error);
        invoicesData = [];
        filteredInvoices = [];
        renderInvoicesTable();
    }
}

// Load AWS Costs
async function loadAwsCosts() {
    try {
        const data = await apiCall('/billing/admin/aws-costs');
        awsCostsData = data;
        console.log('AWS Costs loaded:', awsCostsData);
    } catch (error) {
        console.error('Error loading AWS costs:', error);
        awsCostsData = { currentMonth: { total: 0 }, previousMonth: { total: 0 } };
    }
}

// Update Stats
function updateStats() {
    const activeTenants = tenantsData.filter(t => t.status === 'active').length;
    const openInvoices = invoicesData.filter(i => i.status === 'open').length;
    
    // Calculate monthly revenue from paid invoices this month
    const monthlyRevenue = invoicesData
        .filter(i => i.status === 'paid' && isCurrentMonth(i.paid_at))
        .reduce((sum, i) => sum + (i.amount || 0), 0);
    
    // Also add open invoices as expected revenue
    const expectedRevenue = invoicesData
        .filter(i => i.status === 'open')
        .reduce((sum, i) => sum + (i.amount || 0), 0);
    
    // Total revenue = paid + expected from open invoices
    const totalMonthlyRevenue = monthlyRevenue + expectedRevenue;
    
    // AWS costs from Cost Explorer
    const monthlyAwsCosts = awsCostsData?.currentMonth?.total || 0;
    
    // Calculate profit
    const monthlyProfit = totalMonthlyRevenue - monthlyAwsCosts;
    
    document.getElementById('statTenants').textContent = activeTenants;
    document.getElementById('statOpenInvoices').textContent = openInvoices;
    document.getElementById('statRevenue').textContent = formatCurrency(totalMonthlyRevenue);
    document.getElementById('statAwsCosts').textContent = formatCurrency(monthlyAwsCosts);
    document.getElementById('statProfit').textContent = formatCurrency(monthlyProfit);
    
    // Update profit color based on value
    const profitEl = document.getElementById('statProfit');
    if (monthlyProfit < 0) {
        profitEl.classList.remove('text-green-400');
        profitEl.classList.add('text-red-400');
    } else {
        profitEl.classList.remove('text-red-400');
        profitEl.classList.add('text-green-400');
    }
    
    // Render monthly performance chart
    renderMonthlyChart();
}

// Render Tenants Table
function renderTenantsTable(data = null) {
    const tbody = document.getElementById('tenantsTableBody');
    const displayData = data || filteredTenants;
    
    if (displayData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center text-dark-400">Keine Tenants gefunden</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = displayData.map(tenant => {
        const isPlatformTenant = tenant.tenant_id === 'platform';
        return `
        <tr class="border-t border-dark-600 hover:bg-dark-800/50">
            <td class="px-6 py-4">
                <div class="font-semibold">${tenant.creator_name || tenant.tenant_id}</div>
                <div class="text-xs text-primary-400">${tenant.creator_email || tenant.admin_email || '-'}</div>
                <div class="text-xs text-dark-400">${tenant.tenant_id}</div>
            </td>
            <td class="px-6 py-4">
                ${tenant.subdomain ? `<a href="https://${tenant.subdomain}.viraltenant.com" target="_blank" class="text-primary-500 hover:underline">${tenant.subdomain}.viraltenant.com</a>` : '-'}
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(tenant.status)}">
                    ${getStatusText(tenant.status)}
                </span>
            </td>
            <td class="px-6 py-4 text-right font-mono">${formatCurrency(tenant.currentMonthTotal || 20)}</td>
            <td class="px-6 py-4 text-right font-mono ${tenant.openInvoicesAmount > 0 ? 'text-yellow-500' : ''}">${formatCurrency(tenant.openInvoicesAmount || 0)}</td>
            <td class="px-6 py-4 text-right font-mono text-green-500">${formatCurrency(tenant.paidTotal || 0)}</td>
            <td class="px-6 py-4 text-center">
                ${isPlatformTenant 
                    ? '<span class="text-dark-500 text-xs">Geschützt</span>'
                    : `<button onclick="showTenantInfo('${tenant.tenant_id}')" 
                        class="px-3 py-1 bg-primary-500/20 hover:bg-primary-500/40 text-primary-400 rounded-lg text-sm transition-colors">
                        Info
                    </button>`
                }
            </td>
        </tr>
    `}).join('');
}

// Render Invoices Table
function renderInvoicesTable(data = null) {
    const tbody = document.getElementById('invoicesTableBody');
    const displayData = data || filteredInvoices;
    
    console.log('Rendering invoices table with', displayData.length, 'invoices');
    
    if (displayData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-dark-400">Keine Rechnungen gefunden</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = displayData.map(invoice => {
        const invoiceId = invoice.invoice_number || invoice.invoice_id;
        const hasPdf = !!invoice.pdf_key || !!invoice.pdf_url;
        
        // Get tenant info
        const tenantName = getTenantName(invoice.user_id);
        
        // Shorten tenant ID for display
        const shortTenantId = invoice.user_id ? invoice.user_id.substring(0, 8) + '...' : '-';
        
        return `
        <tr class="border-t border-dark-600 hover:bg-dark-800/50">
            <td class="px-4 py-3 font-mono text-sm whitespace-nowrap">${invoice.invoice_number || invoice.invoice_id}</td>
            <td class="px-4 py-3">
                <div class="font-semibold text-sm truncate max-w-[150px]" title="${tenantName}">${tenantName}</div>
                <div class="text-xs text-dark-400" title="${invoice.user_id}">${shortTenantId}</div>
            </td>
            <td class="px-4 py-3 text-sm whitespace-nowrap">${formatPeriod(invoice.period)}</td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getInvoiceStatusClass(invoice.status)}">
                    ${getInvoiceStatusText(invoice.status)}
                </span>
            </td>
            <td class="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">${formatCurrency(invoice.amount)}</td>
            <td class="px-4 py-3 text-right text-sm text-dark-400 whitespace-nowrap">${formatDate(invoice.created_at)}</td>
            <td class="px-4 py-3 text-center">
                ${hasPdf ? `<button onclick="downloadPDF('${invoiceId}')" class="text-primary-500 hover:text-primary-400 text-sm">PDF</button>` : '-'}
            </td>
        </tr>
    `}).join('');
}

// Render Consumption Table
function renderConsumptionTable(data = null) {
    const tbody = document.getElementById('consumptionTableBody');
    const displayData = data || filteredTenants;
    
    if (displayData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center text-dark-400">Keine Daten verfügbar</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = displayData.map(tenant => {
        const breakdown = tenant.awsBreakdown || {};
        const baseFee = 30;
        const multistream = breakdown.multistream || 0;
        const videohost = breakdown.videohost || 0;
        const domain = breakdown.domain || 0;
        const crosspost = breakdown.crosspost || 0;
        const total = baseFee + multistream + videohost + domain + crosspost;
        
        return `
            <tr class="border-t border-dark-600 hover:bg-dark-800/50">
                <td class="px-6 py-4 font-semibold">${tenant.creator_name || tenant.tenant_id}</td>
                <td class="px-6 py-4 text-right font-mono">${formatCurrency(baseFee)}</td>
                <td class="px-6 py-4 text-right font-mono">${formatCurrency(multistream)}</td>
                <td class="px-6 py-4 text-right font-mono">${formatCurrency(videohost)}</td>
                <td class="px-6 py-4 text-right font-mono">${formatCurrency(domain)}</td>
                <td class="px-6 py-4 text-right font-mono">${formatCurrency(crosspost)}</td>
                <td class="px-6 py-4 text-right font-mono font-bold text-primary-500">${formatCurrency(total)}</td>
            </tr>
        `;
    }).join('');
}

// Tab Navigation
function showTab(tab) {
    // Update tab buttons
    document.querySelectorAll('[id^="tab"]').forEach(btn => {
        btn.classList.remove('border-primary-500', 'text-primary-500');
        btn.classList.add('border-transparent', 'text-dark-400');
    });
    document.getElementById(`tab${capitalize(tab)}`).classList.remove('border-transparent', 'text-dark-400');
    document.getElementById(`tab${capitalize(tab)}`).classList.add('border-primary-500', 'text-primary-500');
    
    // Show/hide sections
    document.getElementById('tenantsSection').classList.add('hidden');
    document.getElementById('invoicesSection').classList.add('hidden');
    document.getElementById('consumptionSection').classList.add('hidden');
    document.getElementById(`${tab}Section`).classList.remove('hidden');
}

// Generate Invoices
async function generateInvoices() {
    if (!confirm('Monatliche Rechnungen für alle Tenants generieren?\n\nDies erstellt Rechnungen für den Vormonat und sendet E-Mails an alle Tenant-Admins.')) {
        return;
    }
    
    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generiere...';
    
    try {
        const result = await apiCall('/billing/generate-invoices', 'POST');
        console.log('Generate invoices result:', result);
        
        let message = `Rechnungserstellung abgeschlossen!\n\n`;
        
        // Handle different response formats
        if (result.billingPeriod) {
            message += `Zeitraum: ${result.billingPeriod}\n`;
        }
        
        // Check if summary exists (from billing-cron)
        if (result.summary) {
            message += `Verarbeitet: ${result.summary.processed || 0}\n`;
            message += `Übersprungen: ${result.summary.skipped || 0}\n`;
            message += `Fehler: ${result.summary.errors?.length || 0}\n`;
            
            if (result.summary.invoices && result.summary.invoices.length > 0) {
                message += `\nErstellte Rechnungen:\n`;
                result.summary.invoices.forEach(inv => {
                    message += `• ${inv.invoiceNumber}: ${formatCurrency(inv.amount)} ${inv.emailSent ? '✉️' : ''}\n`;
                });
            }
            
            // Show trial info if available
            if (result.summary.trials) {
                message += `\nTrial-Verarbeitung:\n`;
                message += `• Geprüft: ${result.summary.trials.checked || 0}\n`;
                message += `• Warnungen: ${result.summary.trials.warnings_sent || 0}\n`;
                message += `• Abgelaufen: ${result.summary.trials.expired || 0}\n`;
            }
            
            // Show reminder info if available
            if (result.summary.reminders) {
                message += `\nMahnungen:\n`;
                message += `• Geprüft: ${result.summary.reminders.checked || 0}\n`;
                message += `• Gesendet: ${result.summary.reminders.reminders_sent || 0}\n`;
            }
        } else if (result.success !== undefined) {
            // Simple success response
            message += result.success ? 'Erfolgreich abgeschlossen.' : 'Mit Fehlern abgeschlossen.';
            if (result.error) {
                message += `\nFehler: ${result.error}`;
            }
        } else if (result.error) {
            // Error response
            message = `Fehler: ${result.error}\n${result.message || ''}`;
        }
        
        alert(message);
        loadAllData();
    } catch (error) {
        console.error('Error generating invoices:', error);
        alert('Fehler: ' + (error.message || 'Unbekannter Fehler'));
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> Monatliche Rechnungen generieren';
    }
}

// Download PDF - using fetch and blob for reliable downloads
async function downloadPDF(invoiceId) {
    console.log('downloadPDF called with invoiceId:', invoiceId);
    
    if (!invoiceId) {
        alert('Fehler: Keine Rechnungs-ID');
        return;
    }
    
    // Get the button and show loading
    const btn = event?.target;
    if (btn) {
        btn.textContent = '⏳';
        btn.disabled = true;
    }
    
    try {
        // Get presigned URL from API
        const data = await apiCall(`/billing/admin/invoices/${invoiceId}/pdf`);
        
        if (!data.url) {
            alert('PDF nicht verfügbar');
            return;
        }
        
        // Fetch the PDF as blob
        const response = await fetch(data.url);
        if (!response.ok) throw new Error('Download fehlgeschlagen');
        
        const blob = await response.blob();
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rechnung_${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error downloading PDF:', error);
        alert('Download fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler'));
    } finally {
        if (btn) {
            btn.textContent = 'PDF';
            btn.disabled = false;
        }
    }
}

// Helper Functions
function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
}

function formatPeriod(period) {
    if (!period?.start) return '-';
    const start = new Date(period.start);
    return start.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function isCurrentMonth(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getTenantName(tenantId) {
    const tenant = tenantsData.find(t => t.tenant_id === tenantId);
    return tenant?.creator_name || tenantId;
}

function getTenantAdminEmail(tenantId) {
    const tenant = tenantsData.find(t => t.tenant_id === tenantId);
    return tenant?.creator_email || tenant?.admin_email || '-';
}

function getStatusClass(status) {
    switch (status) {
        case 'active': return 'bg-green-500/20 text-green-400';
        case 'pending': return 'bg-yellow-500/20 text-yellow-400';
        case 'suspended': return 'bg-red-500/20 text-red-400';
        default: return 'bg-gray-500/20 text-gray-400';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'active': return 'Aktiv';
        case 'pending': return 'Ausstehend';
        case 'suspended': return 'Gesperrt';
        default: return status;
    }
}

function getInvoiceStatusClass(status) {
    switch (status) {
        case 'paid': return 'bg-green-500/20 text-green-400';
        case 'open': return 'bg-yellow-500/20 text-yellow-400';
        case 'overdue': return 'bg-red-500/20 text-red-400';
        default: return 'bg-gray-500/20 text-gray-400';
    }
}

function getInvoiceStatusText(status) {
    switch (status) {
        case 'paid': return 'Bezahlt';
        case 'open': return 'Offen';
        case 'overdue': return 'Überfällig';
        case 'draft': return 'Entwurf';
        default: return status;
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================
// TABLE SORTING
// ============================================================

// Track current sort state per table
const sortState = {
    tenants: { column: null, direction: 'asc' },
    invoices: { column: null, direction: 'asc' },
    consumption: { column: null, direction: 'asc' }
};

// Main sort function - called when clicking table headers
function sortTable(table, column) {
    const state = sortState[table];
    
    // Toggle direction if same column, otherwise reset to desc (for numbers) or asc (for text)
    if (state.column === column) {
        state.direction = state.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.column = column;
        // Default to desc for numeric columns, asc for text
        const numericColumns = ['currentMonth', 'openInvoices', 'paidTotal', 'amount', 'baseFee', 'multistream', 'videohost', 'domain', 'crosspost', 'total'];
        state.direction = numericColumns.includes(column) ? 'desc' : 'asc';
    }
    
    // Update header styles
    updateSortHeaders(table, column, state.direction);
    
    // Sort and render
    switch (table) {
        case 'tenants':
            sortAndRenderTenants(column, state.direction);
            break;
        case 'invoices':
            sortAndRenderInvoices(column, state.direction);
            break;
        case 'consumption':
            sortAndRenderConsumption(column, state.direction);
            break;
    }
}

// Update header visual indicators
function updateSortHeaders(table, activeColumn, direction) {
    const tableEl = document.getElementById(`${table}Table`);
    if (!tableEl) return;
    
    tableEl.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sort === activeColumn) {
            th.classList.add(direction);
        }
    });
}

// Sort Tenants
function sortAndRenderTenants(column, direction) {
    const multiplier = direction === 'asc' ? 1 : -1;
    
    filteredTenants.sort((a, b) => {
        let valA, valB;
        
        switch (column) {
            case 'name':
                valA = (a.creator_name || a.tenant_id || '').toLowerCase();
                valB = (b.creator_name || b.tenant_id || '').toLowerCase();
                return valA.localeCompare(valB) * multiplier;
            case 'subdomain':
                valA = (a.subdomain || '').toLowerCase();
                valB = (b.subdomain || '').toLowerCase();
                return valA.localeCompare(valB) * multiplier;
            case 'status':
                valA = a.status || '';
                valB = b.status || '';
                return valA.localeCompare(valB) * multiplier;
            case 'currentMonth':
                valA = a.currentMonthTotal || 0;
                valB = b.currentMonthTotal || 0;
                return (valA - valB) * multiplier;
            case 'openInvoices':
                valA = a.openInvoicesAmount || 0;
                valB = b.openInvoicesAmount || 0;
                return (valA - valB) * multiplier;
            case 'paidTotal':
                valA = a.paidTotal || 0;
                valB = b.paidTotal || 0;
                return (valA - valB) * multiplier;
            default:
                return 0;
        }
    });
    
    renderTenantsTable();
}

// Sort Invoices
function sortAndRenderInvoices(column, direction) {
    const multiplier = direction === 'asc' ? 1 : -1;
    
    filteredInvoices.sort((a, b) => {
        let valA, valB;
        
        switch (column) {
            case 'invoiceNumber':
                valA = (a.invoice_number || a.invoice_id || '').toLowerCase();
                valB = (b.invoice_number || b.invoice_id || '').toLowerCase();
                return valA.localeCompare(valB) * multiplier;
            case 'tenant':
                valA = getTenantName(a.user_id).toLowerCase();
                valB = getTenantName(b.user_id).toLowerCase();
                return valA.localeCompare(valB) * multiplier;
            case 'tenantId':
                valA = (a.user_id || '').toLowerCase();
                valB = (b.user_id || '').toLowerCase();
                return valA.localeCompare(valB) * multiplier;
            case 'period':
                valA = a.period?.start ? new Date(a.period.start).getTime() : 0;
                valB = b.period?.start ? new Date(b.period.start).getTime() : 0;
                return (valA - valB) * multiplier;
            case 'status':
                // Custom order: open > overdue > paid > draft
                const statusOrder = { open: 1, overdue: 2, paid: 3, draft: 4 };
                valA = statusOrder[a.status] || 5;
                valB = statusOrder[b.status] || 5;
                return (valA - valB) * multiplier;
            case 'amount':
                valA = a.amount || 0;
                valB = b.amount || 0;
                return (valA - valB) * multiplier;
            case 'createdAt':
                valA = a.created_at ? new Date(a.created_at).getTime() : 0;
                valB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return (valA - valB) * multiplier;
            case 'reminder':
                valA = a.reminder_sent ? 1 : 0;
                valB = b.reminder_sent ? 1 : 0;
                return (valA - valB) * multiplier;
            default:
                return 0;
        }
    });
    
    renderInvoicesTable();
}

// Sort Consumption
function sortAndRenderConsumption(column, direction) {
    const multiplier = direction === 'asc' ? 1 : -1;
    
    filteredTenants.sort((a, b) => {
        const breakdownA = a.awsBreakdown || {};
        const breakdownB = b.awsBreakdown || {};
        let valA, valB;
        
        switch (column) {
            case 'name':
                valA = (a.creator_name || a.tenant_id || '').toLowerCase();
                valB = (b.creator_name || b.tenant_id || '').toLowerCase();
                return valA.localeCompare(valB) * multiplier;
            case 'baseFee':
                return 0; // All same (30€)
            case 'multistream':
                valA = breakdownA.multistream || 0;
                valB = breakdownB.multistream || 0;
                return (valA - valB) * multiplier;
            case 'videohost':
                valA = breakdownA.videohost || 0;
                valB = breakdownB.videohost || 0;
                return (valA - valB) * multiplier;
            case 'domain':
                valA = breakdownA.domain || 0;
                valB = breakdownB.domain || 0;
                return (valA - valB) * multiplier;
            case 'crosspost':
                valA = breakdownA.crosspost || 0;
                valB = breakdownB.crosspost || 0;
                return (valA - valB) * multiplier;
            case 'total':
                valA = 30 + (breakdownA.multistream || 0) + (breakdownA.videohost || 0) + (breakdownA.domain || 0) + (breakdownA.crosspost || 0);
                valB = 30 + (breakdownB.multistream || 0) + (breakdownB.videohost || 0) + (breakdownB.domain || 0) + (breakdownB.crosspost || 0);
                return (valA - valB) * multiplier;
            default:
                return 0;
        }
    });
    
    renderConsumptionTable();
}

// ============================================================
// FILTER FUNCTIONS
// ============================================================

// Populate Invoice Tenant Filter
function populateInvoiceTenantFilter() {
    const select = document.getElementById('invoiceTenantFilter');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">Alle Tenants</option>';
    
    tenantsData.forEach(tenant => {
        const option = document.createElement('option');
        option.value = tenant.tenant_id;
        option.textContent = tenant.creator_name || tenant.tenant_id;
        select.appendChild(option);
    });
    
    select.value = currentValue;
}

// Populate Invoice Period Filter
function populateInvoicePeriodFilter() {
    const select = document.getElementById('invoicePeriodFilter');
    if (!select) return;
    
    const currentValue = select.value;
    const periods = new Set();
    
    invoicesData.forEach(invoice => {
        if (invoice.period?.start) {
            const date = new Date(invoice.period.start);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            periods.add(key);
        }
    });
    
    select.innerHTML = '<option value="">Alle Zeiträume</option>';
    
    [...periods].sort().reverse().forEach(period => {
        const [year, month] = period.split('-');
        const date = new Date(year, month - 1);
        const option = document.createElement('option');
        option.value = period;
        option.textContent = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        select.appendChild(option);
    });
    
    select.value = currentValue;
}

// Filter Tenants
function filterTenants() {
    const search = (document.getElementById('tenantSearch')?.value || '').toLowerCase();
    const status = document.getElementById('tenantStatusFilter')?.value || '';
    const sort = document.getElementById('tenantSortFilter')?.value || 'name';
    
    // Filter
    filteredTenants = tenantsData.filter(tenant => {
        const matchesSearch = !search || 
            (tenant.creator_name || '').toLowerCase().includes(search) ||
            (tenant.tenant_id || '').toLowerCase().includes(search) ||
            (tenant.subdomain || '').toLowerCase().includes(search);
        
        const matchesStatus = !status || tenant.status === status;
        
        return matchesSearch && matchesStatus;
    });
    
    // Sort
    filteredTenants.sort((a, b) => {
        switch (sort) {
            case 'name':
                return (a.creator_name || a.tenant_id).localeCompare(b.creator_name || b.tenant_id);
            case 'name-desc':
                return (b.creator_name || b.tenant_id).localeCompare(a.creator_name || a.tenant_id);
            case 'amount-desc':
                return (b.currentMonthTotal || 0) - (a.currentMonthTotal || 0);
            case 'amount':
                return (a.currentMonthTotal || 0) - (b.currentMonthTotal || 0);
            case 'open-desc':
                return (b.openInvoicesAmount || 0) - (a.openInvoicesAmount || 0);
            default:
                return 0;
        }
    });
    
    // Update info
    updateFilterInfo('tenantFilterInfo', filteredTenants.length, tenantsData.length);
    
    renderTenantsTable();
}

// Reset Tenant Filters
function resetTenantFilters() {
    document.getElementById('tenantSearch').value = '';
    document.getElementById('tenantStatusFilter').value = '';
    document.getElementById('tenantSortFilter').value = 'name';
    filteredTenants = [...tenantsData];
    document.getElementById('tenantFilterInfo').classList.add('hidden');
    renderTenantsTable();
}

// Filter Invoices
function filterInvoices() {
    const search = (document.getElementById('invoiceSearch')?.value || '').toLowerCase();
    const status = document.getElementById('invoiceStatusFilter')?.value || '';
    const tenantId = document.getElementById('invoiceTenantFilter')?.value || '';
    const period = document.getElementById('invoicePeriodFilter')?.value || '';
    const sort = document.getElementById('invoiceSortFilter')?.value || 'date-desc';
    
    // Filter
    filteredInvoices = invoicesData.filter(invoice => {
        const tenantName = getTenantName(invoice.user_id).toLowerCase();
        const invoiceNum = (invoice.invoice_number || invoice.invoice_id || '').toLowerCase();
        
        const matchesSearch = !search || 
            tenantName.includes(search) ||
            invoiceNum.includes(search);
        
        const matchesStatus = !status || invoice.status === status;
        const matchesTenant = !tenantId || invoice.user_id === tenantId;
        
        let matchesPeriod = true;
        if (period && invoice.period?.start) {
            const date = new Date(invoice.period.start);
            const invoicePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            matchesPeriod = invoicePeriod === period;
        }
        
        return matchesSearch && matchesStatus && matchesTenant && matchesPeriod;
    });
    
    // Sort
    filteredInvoices.sort((a, b) => {
        switch (sort) {
            case 'date-desc':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'date':
                return new Date(a.created_at) - new Date(b.created_at);
            case 'amount-desc':
                return (b.amount || 0) - (a.amount || 0);
            case 'amount':
                return (a.amount || 0) - (b.amount || 0);
            default:
                return 0;
        }
    });
    
    // Update info
    updateFilterInfo('invoiceFilterInfo', filteredInvoices.length, invoicesData.length);
    
    renderInvoicesTable();
}

// Reset Invoice Filters
function resetInvoiceFilters() {
    document.getElementById('invoiceSearch').value = '';
    document.getElementById('invoiceStatusFilter').value = '';
    document.getElementById('invoiceTenantFilter').value = '';
    document.getElementById('invoicePeriodFilter').value = '';
    document.getElementById('invoiceSortFilter').value = 'date-desc';
    filteredInvoices = [...invoicesData];
    document.getElementById('invoiceFilterInfo').classList.add('hidden');
    renderInvoicesTable();
}

// Filter Consumption
function filterConsumption() {
    const search = (document.getElementById('consumptionSearch')?.value || '').toLowerCase();
    const sort = document.getElementById('consumptionSortFilter')?.value || 'total-desc';
    
    // Filter
    let filtered = tenantsData.filter(tenant => {
        return !search || 
            (tenant.creator_name || '').toLowerCase().includes(search) ||
            (tenant.tenant_id || '').toLowerCase().includes(search);
    });
    
    // Calculate totals for sorting
    const withTotals = filtered.map(tenant => {
        const breakdown = tenant.awsBreakdown || {};
        const total = 20 + (breakdown.multistream || 0) + (breakdown.videohost || 0) + 
                      (breakdown.domain || 0) + (breakdown.crosspost || 0);
        return { ...tenant, _total: total };
    });
    
    // Sort
    withTotals.sort((a, b) => {
        const breakdownA = a.awsBreakdown || {};
        const breakdownB = b.awsBreakdown || {};
        
        switch (sort) {
            case 'total-desc':
                return b._total - a._total;
            case 'total':
                return a._total - b._total;
            case 'name':
                return (a.creator_name || a.tenant_id).localeCompare(b.creator_name || b.tenant_id);
            case 'multistream-desc':
                return (breakdownB.multistream || 0) - (breakdownA.multistream || 0);
            case 'videohost-desc':
                return (breakdownB.videohost || 0) - (breakdownA.videohost || 0);
            default:
                return 0;
        }
    });
    
    filteredTenants = withTotals;
    
    // Update info
    updateFilterInfo('consumptionFilterInfo', withTotals.length, tenantsData.length);
    
    renderConsumptionTable();
}

// Reset Consumption Filters
function resetConsumptionFilters() {
    document.getElementById('consumptionSearch').value = '';
    document.getElementById('consumptionSortFilter').value = 'total-desc';
    filteredTenants = [...tenantsData];
    document.getElementById('consumptionFilterInfo').classList.add('hidden');
    renderConsumptionTable();
}

// Update Filter Info
function updateFilterInfo(elementId, filtered, total) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (filtered < total) {
        el.textContent = `${filtered} von ${total} Einträgen angezeigt`;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

// ============================================================
// MONTHLY PERFORMANCE CHART
// ============================================================

function renderMonthlyChart() {
    const container = document.getElementById('chartContainer');
    const labelsContainer = document.getElementById('chartLabels');
    if (!container || !labelsContainer) {
        console.log('Chart containers not found');
        return;
    }
    
    console.log('Rendering chart with invoices:', invoicesData.length);
    
    // Get monthly data from invoices
    const monthlyData = getMonthlyPerformanceData();
    console.log('Monthly data:', monthlyData);
    
    // Find max value for scaling
    const maxValue = Math.max(
        ...monthlyData.map(m => Math.max(m.revenue, m.costs, Math.abs(m.profit))),
        100 // Minimum scale
    );
    
    // Render bars
    container.innerHTML = monthlyData.map((month, index) => {
        const revenueHeight = Math.max((month.revenue / maxValue) * 100, 2);
        const costsHeight = Math.max((month.costs / maxValue) * 100, 2);
        const profitHeight = Math.max((Math.abs(month.profit) / maxValue) * 100, 2);
        const profitColor = month.profit >= 0 ? '#8b5cf6' : '#f97316';
        
        return `
            <div class="flex-1 flex flex-col items-center gap-1 group relative" style="height: 100%;">
                <div class="w-full flex gap-0.5 items-end" style="height: 100%;">
                    <div class="flex-1 rounded-t transition-all" 
                         style="height: ${revenueHeight}%; background-color: rgba(34, 197, 94, 0.8); min-height: 4px;"
                         title="Umsatz: ${formatCurrency(month.revenue)}"></div>
                    <div class="flex-1 rounded-t transition-all" 
                         style="height: ${costsHeight}%; background-color: rgba(248, 113, 113, 0.8); min-height: 4px;"
                         title="Kosten: ${formatCurrency(month.costs)}"></div>
                    <div class="flex-1 rounded-t transition-all" 
                         style="height: ${profitHeight}%; background-color: ${profitColor}; opacity: 0.8; min-height: 4px;"
                         title="Gewinn: ${formatCurrency(month.profit)}"></div>
                </div>
                <!-- Tooltip -->
                <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-800 border border-dark-600 rounded-lg p-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div class="font-semibold mb-1">${month.label}</div>
                    <div class="text-green-400">Umsatz: ${formatCurrency(month.revenue)}</div>
                    <div class="text-red-400">Kosten: ${formatCurrency(month.costs)}</div>
                    <div class="${month.profit >= 0 ? 'text-primary-400' : 'text-orange-400'}">Gewinn: ${formatCurrency(month.profit)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Render labels
    labelsContainer.innerHTML = monthlyData.map(month => `
        <div class="flex-1 text-center">${month.shortLabel}</div>
    `).join('');
}

function getMonthlyPerformanceData() {
    const months = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Get last 12 months
    for (let i = 11; i >= 0; i--) {
        const date = new Date(currentYear, now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        // Calculate revenue for this month from invoices
        const monthRevenue = invoicesData
            .filter(inv => {
                if (!inv.period?.start) return false;
                const invDate = new Date(inv.period.start);
                return invDate.getFullYear() === year && invDate.getMonth() === month;
            })
            .reduce((sum, inv) => sum + (inv.amount || 0), 0);
        
        // Estimate AWS costs (we only have current month data, so estimate based on tenants)
        // For past months, estimate based on number of active tenants * average cost
        let monthCosts = 0;
        if (i === 0) {
            // Current month - use actual AWS costs
            monthCosts = awsCostsData?.currentMonth?.total || 0;
        } else if (i === 1) {
            // Previous month - use previous month data if available
            monthCosts = awsCostsData?.previousMonth?.total || 0;
        } else {
            // Older months - estimate based on revenue ratio (assume ~30% costs)
            monthCosts = monthRevenue * 0.3;
        }
        
        months.push({
            year,
            month,
            label: date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
            shortLabel: date.toLocaleDateString('de-DE', { month: 'short' }),
            revenue: monthRevenue,
            costs: monthCosts,
            profit: monthRevenue - monthCosts
        });
    }
    
    return months;
}


// ============================================================
// TENANT MANAGEMENT
// ============================================================

let currentTenantId = null;
let currentTenantData = null;

// Show Tenant Info Modal
async function showTenantInfo(tenantId) {
    currentTenantId = tenantId;
    const tenant = tenantsData.find(t => t.tenant_id === tenantId);
    
    if (!tenant) {
        alert('Tenant nicht gefunden');
        return;
    }
    
    currentTenantData = tenant;
    
    // Show modal with loading state
    document.getElementById('tenantModal').classList.remove('hidden');
    document.getElementById('tenantModalContent').innerHTML = `
        <div class="flex justify-center py-8">
            <div class="loader"></div>
        </div>
    `;
    
    try {
        // Load detailed tenant info
        const details = await loadTenantDetails(tenantId);
        renderTenantModal(tenant, details);
    } catch (error) {
        console.error('Error loading tenant details:', error);
        renderTenantModal(tenant, null);
    }
}

// Load Tenant Details from API
async function loadTenantDetails(tenantId) {
    try {
        const data = await apiCall(`/billing/admin/tenants/${tenantId}`);
        return data;
    } catch (error) {
        console.error('Error loading tenant details:', error);
        return null;
    }
}

// Render Tenant Modal Content
function renderTenantModal(tenant, details) {
    const isSuspended = tenant.status === 'suspended';
    
    // Update suspend button text
    document.getElementById('suspendBtnText').textContent = isSuspended ? 'Entsperren' : 'Sperren';
    document.getElementById('tenantSuspendBtn').className = isSuspended 
        ? 'px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors flex items-center gap-2'
        : 'px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold transition-colors flex items-center gap-2';
    
    // Get tenant invoices
    const tenantInvoices = invoicesData.filter(i => i.user_id === tenant.tenant_id);
    const openInvoices = tenantInvoices.filter(i => i.status === 'open');
    const paidInvoices = tenantInvoices.filter(i => i.status === 'paid');
    
    // Calculate totals
    const openAmount = openInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const paidAmount = paidInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    
    // IVS Resources
    const hasIvs = details?.ivs_channel_arn || details?.ivs_chat_room_arn;
    const s3Objects = details?.s3_objects_count || 0;
    
    const content = `
        <div class="space-y-6">
            <!-- Basic Info -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-dark-400 text-sm">Creator Name</div>
                    <div class="font-semibold text-lg">${tenant.creator_name || '-'}</div>
                </div>
                <div>
                    <div class="text-dark-400 text-sm">Status</div>
                    <div>
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(tenant.status)}">
                            ${getStatusText(tenant.status)}
                        </span>
                    </div>
                </div>
                <div>
                    <div class="text-dark-400 text-sm">Subdomain</div>
                    <div class="font-mono">${tenant.subdomain ? `${tenant.subdomain}.viraltenant.com` : '-'}</div>
                </div>
                <div>
                    <div class="text-dark-400 text-sm">Erstellt am</div>
                    <div>${formatDate(tenant.created_at)}</div>
                </div>
            </div>
            
            <!-- IDs -->
            <div class="bg-dark-800 rounded-lg p-4">
                <div class="text-dark-400 text-sm mb-2">Tenant ID</div>
                <div class="font-mono text-sm break-all">${tenant.tenant_id}</div>
                ${tenant.creator_email ? `
                    <div class="text-dark-400 text-sm mt-3 mb-2">Creator E-Mail</div>
                    <div class="font-mono text-sm">${tenant.creator_email}</div>
                ` : ''}
            </div>
            
            <!-- Billing Info -->
            <div class="grid grid-cols-3 gap-4">
                <div class="bg-dark-800 rounded-lg p-4 text-center">
                    <div class="text-dark-400 text-sm mb-1">Offene Rechnungen</div>
                    <div class="text-2xl font-bold ${openAmount > 0 ? 'text-yellow-500' : ''}">${openInvoices.length}</div>
                    <div class="text-sm text-dark-400">${formatCurrency(openAmount)}</div>
                </div>
                <div class="bg-dark-800 rounded-lg p-4 text-center">
                    <div class="text-dark-400 text-sm mb-1">Bezahlte Rechnungen</div>
                    <div class="text-2xl font-bold text-green-500">${paidInvoices.length}</div>
                    <div class="text-sm text-dark-400">${formatCurrency(paidAmount)}</div>
                </div>
                <div class="bg-dark-800 rounded-lg p-4 text-center">
                    <div class="text-dark-400 text-sm mb-1">Aktueller Monat</div>
                    <div class="text-2xl font-bold text-primary-500">${formatCurrency(tenant.currentMonthTotal || 30)}</div>
                </div>
            </div>
            
            <!-- AWS Resources -->
            <div>
                <div class="text-dark-400 text-sm mb-2">AWS Ressourcen</div>
                <div class="grid grid-cols-2 gap-2">
                    <div class="bg-dark-800 rounded-lg p-3 flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${hasIvs ? 'bg-green-500/20' : 'bg-dark-600'} flex items-center justify-center">
                            ${hasIvs ? '✓' : '-'}
                        </div>
                        <div>
                            <div class="font-medium">IVS Channel</div>
                            <div class="text-xs text-dark-400">${hasIvs ? 'Aktiv' : 'Nicht erstellt'}</div>
                        </div>
                    </div>
                    <div class="bg-dark-800 rounded-lg p-3 flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${s3Objects > 0 ? 'bg-green-500/20' : 'bg-dark-600'} flex items-center justify-center">
                            ${s3Objects > 0 ? '✓' : '-'}
                        </div>
                        <div>
                            <div class="font-medium">S3 Objekte</div>
                            <div class="text-xs text-dark-400">${s3Objects} Dateien</div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${openAmount > 0 ? `
                <!-- Warning for unpaid invoices -->
                <div class="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
                    <div class="flex items-center gap-2 text-yellow-400 font-semibold mb-1">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        Offene Rechnungen
                    </div>
                    <p class="text-sm text-dark-300">
                        Dieser Tenant hat ${openInvoices.length} offene Rechnung(en) im Wert von ${formatCurrency(openAmount)}.
                        Bei Sperrung wird dem Nutzer eine Warnmeldung angezeigt.
                    </p>
                </div>
            ` : ''}
            
            <!-- Recent Invoices -->
            ${tenantInvoices.length > 0 ? `
                <div>
                    <div class="text-dark-400 text-sm mb-2">Letzte Rechnungen</div>
                    <div class="bg-dark-800 rounded-lg overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-dark-700">
                                <tr>
                                    <th class="text-left px-3 py-2">Nr.</th>
                                    <th class="text-left px-3 py-2">Zeitraum</th>
                                    <th class="text-left px-3 py-2">Status</th>
                                    <th class="text-right px-3 py-2">Betrag</th>
                                    <th class="text-center px-3 py-2">PDF</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tenantInvoices.slice(0, 5).map(inv => {
                                    const invoiceId = inv.invoice_number || inv.invoice_id;
                                    const hasPdf = !!inv.pdf_key || !!inv.pdf_url;
                                    return `
                                    <tr class="border-t border-dark-600">
                                        <td class="px-3 py-2 font-mono">${inv.invoice_number || inv.invoice_id}</td>
                                        <td class="px-3 py-2">${formatPeriod(inv.period)}</td>
                                        <td class="px-3 py-2">
                                            <span class="px-2 py-0.5 rounded-full text-xs ${getInvoiceStatusClass(inv.status)}">
                                                ${getInvoiceStatusText(inv.status)}
                                            </span>
                                        </td>
                                        <td class="px-3 py-2 text-right font-mono">${formatCurrency(inv.amount)}</td>
                                        <td class="px-3 py-2 text-center">
                                            ${hasPdf ? `<button onclick="downloadPDF('${invoiceId}')" class="text-primary-500 hover:text-primary-400">PDF</button>` : '-'}
                                        </td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('tenantModalContent').innerHTML = content;
}

// Close Tenant Modal
function closeTenantModal() {
    document.getElementById('tenantModal').classList.add('hidden');
    currentTenantId = null;
    currentTenantData = null;
}

// Toggle Tenant Suspension
async function toggleTenantSuspension() {
    if (!currentTenantId || !currentTenantData) return;
    
    const isSuspended = currentTenantData.status === 'suspended';
    const action = isSuspended ? 'entsperren' : 'sperren';
    const newStatus = isSuspended ? 'active' : 'suspended';
    
    const reason = isSuspended 
        ? 'Tenant wird wieder aktiviert.'
        : prompt(`Grund für die Sperrung (optional):\n\nBei Sperrung wird dem Nutzer eine Warnmeldung angezeigt, dass er keine Aktionen mehr durchführen kann bis die Rechnungen bezahlt sind.`);
    
    if (reason === null && !isSuspended) return; // User cancelled
    
    if (!confirm(`Möchten Sie den Tenant "${currentTenantData.creator_name || currentTenantId}" wirklich ${action}?`)) {
        return;
    }
    
    try {
        await apiCall(`/billing/admin/tenants/${currentTenantId}/status`, 'PUT', {
            status: newStatus,
            reason: reason || (isSuspended ? 'Entsperrt durch Admin' : 'Gesperrt durch Admin')
        });
        
        alert(`Tenant erfolgreich ${isSuspended ? 'entsperrt' : 'gesperrt'}!`);
        closeTenantModal();
        loadAllData();
    } catch (error) {
        console.error('Error updating tenant status:', error);
        alert('Fehler: ' + (error.message || 'Status konnte nicht geändert werden'));
    }
}

// Delete Tenant
async function deleteTenant() {
    if (!currentTenantId || !currentTenantData) return;
    
    const tenantName = currentTenantData.creator_name || currentTenantId;
    const subdomain = currentTenantData.subdomain;
    
    // First confirmation
    if (!confirm(`⚠️ WARNUNG: Tenant löschen?\n\nTenant: ${tenantName}\nSubdomain: ${subdomain}.viraltenant.com\n\nDies löscht ALLE Daten unwiderruflich:\n- Alle Tenant-Daten\n- Alle S3 Dateien\n- Alle IVS Channels\n- Alle Rechnungen\n- Die Subdomain`)) {
        return;
    }
    
    // Second confirmation with typing
    const confirmText = prompt(`Zur Bestätigung bitte "${subdomain}" eingeben:`);
    if (confirmText !== subdomain) {
        alert('Löschung abgebrochen - Eingabe stimmt nicht überein.');
        return;
    }
    
    try {
        await apiCall(`/billing/admin/tenants/${currentTenantId}`, 'DELETE');
        
        alert(`Tenant "${tenantName}" wurde erfolgreich gelöscht.`);
        closeTenantModal();
        loadAllData();
    } catch (error) {
        console.error('Error deleting tenant:', error);
        alert('Fehler beim Löschen: ' + (error.message || 'Unbekannter Fehler'));
    }
}
