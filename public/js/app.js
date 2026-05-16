document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadLogs();
    loadInfractions();

    document.getElementById('ticketEmbedColor').addEventListener('input', updatePreview);
    document.getElementById('ticketWelcomeMessage').addEventListener('input', updatePreview);

    document.getElementById('config-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                alert('Settings saved successfully!');
            } else {
                alert('Failed to save settings.');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Error saving settings.');
        }
    });
});

function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // Set button as active
    event.currentTarget.classList.add('active');

    // Refresh data if needed
    if (tabId === 'logs') loadLogs();
    if (tabId === 'infractions') loadInfractions();
}

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        
        for (const [key, value] of Object.entries(data)) {
            const el = document.getElementById(key);
            if (el) {
                el.value = value;
            }
        }
        updatePreview();
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

async function loadLogs() {
    try {
        const res = await fetch('/api/logs');
        const logs = await res.json();
        const tbody = document.getElementById('logs-table-body');
        
        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td><span style="background: #272d38; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${log.action}</span></td>
                <td>${log.details}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

async function loadInfractions() {
    try {
        const res = await fetch('/api/infractions');
        const { warnings, bans } = await res.json();
        
        const wTbody = document.getElementById('warnings-table-body');
        wTbody.innerHTML = warnings.map(w => `
            <tr>
                <td>${w.userId}</td>
                <td><span style="color: #facc15; font-weight: bold;">${w.count}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="2">No warnings found.</td></tr>';

        const bTbody = document.getElementById('bans-table-body');
        bTbody.innerHTML = bans.map(b => `
            <tr>
                <td>${new Date(b.timestamp).toLocaleString()}</td>
                <td>${b.userId}</td>
                <td>${b.reason}</td>
                <td>${b.bannedBy}</td>
            </tr>
        `).join('') || '<tr><td colspan="4">No bans found.</td></tr>';
    } catch (error) {
        console.error('Error loading infractions:', error);
    }
}

function updatePreview() {
    const color = document.getElementById('ticketEmbedColor').value || '#0099ff';
    const message = document.getElementById('ticketWelcomeMessage').value || 'Welcome to your ticket! Please wait for a staff member.';
    
    document.getElementById('preview-color').style.backgroundColor = color;
    document.getElementById('preview-description').textContent = message;
}
