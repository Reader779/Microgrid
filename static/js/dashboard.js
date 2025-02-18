// Initialize Socket.IO connection
const socket = io();

// Chart configuration
const maxDataPoints = 20;
const commonOptions = {
    scales: {
        x: {
            type: 'linear',
            position: 'bottom',
            min: 0,
            max: maxDataPoints - 1,
            grid: {
                color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
                display: false
            }
        },
        y: {
            beginAtZero: false,
            grid: {
                color: 'rgba(255, 255, 255, 0.1)'
            }
        }
    },
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        }
    }
};

// Initialize Voltage Chart
const voltageCtx = document.getElementById('voltageChart').getContext('2d');
const voltageChart = new Chart(voltageCtx, {
    type: 'line',
    data: {
        labels: Array.from({length: maxDataPoints}, (_, i) => i),
        datasets: [{
            data: [],
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13, 110, 253, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0
        }]
    },
    options: {
        ...commonOptions,
        scales: {
            ...commonOptions.scales,
            y: {
                ...commonOptions.scales.y,
                min: 200,
                max: 260
            }
        }
    }
});

// Initialize Frequency Chart
const frequencyCtx = document.getElementById('frequencyChart').getContext('2d');
const frequencyChart = new Chart(frequencyCtx, {
    type: 'line',
    data: {
        labels: Array.from({length: maxDataPoints}, (_, i) => i),
        datasets: [{
            data: [],
            borderColor: '#198754',
            backgroundColor: 'rgba(25, 135, 84, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0
        }]
    },
    options: {
        ...commonOptions,
        scales: {
            ...commonOptions.scales,
            y: {
                ...commonOptions.scales.y,
                min: 49,
                max: 51
            }
        }
    }
});

// Control variables
let voltageOffset = 0;
let frequencyOffset = 0;
let voltageData = [];
let frequencyData = [];

function adjustValue(type, value) {
    if (type === 'voltage') {
        voltageOffset = value;
        document.getElementById('voltageOffset').textContent = value;
    } else {
        frequencyOffset = value;
        document.getElementById('frequencyOffset').textContent = value;
    }

    // Send adjustment to server
    socket.emit('manual_adjustment', {
        type: type,
        value: value,
        auto_stabilize: document.getElementById('autoStabilize').checked
    });
}

function calculateStability(values, nominal, tolerance) {
    if (!values.length) return 0;
    const deviations = values.map(v => Math.abs(v - nominal) / nominal * 100);
    const avgDeviation = deviations.reduce((a, b) => a + b) / deviations.length;
    return Math.max(0, 100 - avgDeviation * (100/tolerance));
}

function getVoltageStatus(voltage) {
    if (voltage < 207 || voltage > 253) return ['Danger', 'bg-danger'];
    if (voltage < 218 || voltage > 242) return ['Warning', 'bg-warning'];
    return ['Safe', 'bg-success'];
}

function getFrequencyStatus(frequency) {
    if (frequency < 49.5 || frequency > 50.5) return ['Danger', 'bg-danger'];
    if (frequency < 49.8 || frequency > 50.2) return ['Warning', 'bg-warning'];
    return ['Safe', 'bg-success'];
}

function showAnalysis() {
    const voltageStability = calculateStability(voltageData, 230, 5);
    const frequencyStability = calculateStability(frequencyData, 50, 0.5);

    document.getElementById('voltageStability').textContent = `${voltageStability.toFixed(1)}%`;
    document.getElementById('frequencyStability').textContent = `${frequencyStability.toFixed(1)}%`;

    const avgVoltage = voltageData.length ? 
        voltageData.reduce((a, b) => a + b) / voltageData.length : 0;
    const avgFrequency = frequencyData.length ? 
        frequencyData.reduce((a, b) => a + b) / frequencyData.length : 0;

    const statusEl = document.getElementById('systemStatus');
    let status = '';
    let alertClass = '';

    if (voltageStability > 90 && frequencyStability > 90) {
        status = 'System is operating optimally';
        alertClass = 'alert-success';
    } else if (voltageStability > 70 && frequencyStability > 70) {
        status = 'System is stable but requires monitoring';
        alertClass = 'alert-info';
    } else if (voltageStability > 50 && frequencyStability > 50) {
        status = 'System requires attention';
        alertClass = 'alert-warning';
    } else {
        status = 'System is unstable - immediate action required';
        alertClass = 'alert-danger';
    }

    statusEl.className = `alert ${alertClass}`;
    statusEl.innerHTML = `
        <h5>${status}</h5>
        <p>Average Voltage: ${avgVoltage.toFixed(2)}V<br>
           Average Frequency: ${avgFrequency.toFixed(2)}Hz</p>
    `;
}

// Update dashboard with new data
socket.on('update_data', function(data) {
    // Update voltage chart
    if (voltageChart.data.datasets[0].data.length >= maxDataPoints) {
        voltageChart.data.datasets[0].data.shift();
        voltageData.shift();
    }
    voltageChart.data.datasets[0].data.push(data.voltage);
    voltageData.push(data.voltage);
    voltageChart.update();

    // Update frequency chart
    if (frequencyChart.data.datasets[0].data.length >= maxDataPoints) {
        frequencyChart.data.datasets[0].data.shift();
        frequencyData.shift();
    }
    frequencyChart.data.datasets[0].data.push(data.frequency);
    frequencyData.push(data.frequency);
    frequencyChart.update();

    // Update current values
    document.getElementById('currentVoltage').textContent = data.voltage.toFixed(2);
    document.getElementById('currentFrequency').textContent = data.frequency.toFixed(2);

    // Update predicted values
    document.getElementById('predictedVoltage').textContent = data.predicted_voltage.toFixed(2);
    document.getElementById('predictedFrequency').textContent = data.predicted_frequency.toFixed(2);

    // Update control actions
    const voltageAction = document.getElementById('voltageAction');
    const frequencyAction = document.getElementById('frequencyAction');

    voltageAction.textContent = data.voltage_action;
    frequencyAction.textContent = data.frequency_action;

    // Update action badges colors
    updateActionBadge(voltageAction, data.voltage_action);
    updateActionBadge(frequencyAction, data.frequency_action);

    // Update status indicators
    const [voltageStatusText, voltageStatusClass] = getVoltageStatus(data.voltage);
    const [frequencyStatusText, frequencyStatusClass] = getFrequencyStatus(data.frequency);

    const voltageStatus = document.getElementById('voltageStatus');
    const frequencyStatus = document.getElementById('frequencyStatus');

    voltageStatus.textContent = voltageStatusText;
    frequencyStatus.textContent = frequencyStatusText;

    voltageStatus.className = `badge ${voltageStatusClass}`;
    frequencyStatus.className = `badge ${frequencyStatusClass}`;

    showAnalysis(); //Added here to show analysis after each data update.
});

function updateActionBadge(element, action) {
    element.className = 'badge ' + 
        (action === 'No Action Needed' ? 'bg-success' :
         action.startsWith('Increase') ? 'bg-warning' :
         'bg-danger');
}

// Auto-stabilization toggle handler
document.getElementById('autoStabilize').addEventListener('change', function(e) {
    socket.emit('set_auto_stabilize', {
        enabled: e.target.checked
    });
});