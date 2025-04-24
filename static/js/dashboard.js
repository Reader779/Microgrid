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
let isStabilizing = false;
let isDestabilized = false;
let stabilizationTimer = null;
let mlAnalysisTimer = null;

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
    
    // Update ML analysis and recommendations when analysis is shown
    updateMachineLearningAnalysis();
    updateSystemRecommendations();
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

    console.log(data)

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

// Custom value adjustment function
function adjustCustomValue(type, direction) {
    const inputId = type === 'voltage' ? 'customVoltage' : 'customFrequency';
    const input = document.getElementById(inputId);
    let value = parseFloat(input.value);
    
    if (direction > 0) {
        if (type === 'voltage') {
            value = Math.min(25, value + 1);
        } else {
            value = Math.min(1, value + 0.1);
        }
    } else {
        if (type === 'voltage') {
            value = Math.max(1, value - 1);
        } else {
            value = Math.max(0.1, value - 0.1);
        }
    }
    
    input.value = type === 'voltage' ? value : value.toFixed(1);
    
    // Apply the custom value
    adjustValue(type, type === 'voltage' ? value : value);
}

// Destabilize the system
function destabilizeSystem() {
    if (isDestabilized) {
        return; // Already destabilized
    }
    
    isDestabilized = true;
    const btn = document.getElementById('destabilizeBtn');
    btn.innerHTML = '<i class="bi bi-lightning-fill"></i> System Destabilized';
    btn.classList.add('active');
    
    // Apply random offsets to voltage and frequency
    const randomVoltageOffset = Math.random() > 0.5 ? 15 : -15;
    const randomFrequencyOffset = Math.random() > 0.5 ? 0.8 : -0.8;
    
    adjustValue('voltage', randomVoltageOffset);
    adjustValue('frequency', randomFrequencyOffset);
    
    document.getElementById('autoStabilize').checked = false;
    socket.emit('set_auto_stabilize', { enabled: false });
    
    updateStabilizationStatus('System Destabilized', 'bg-danger');
    
    // Schedule auto-recovery after 15 seconds if auto-stabilize is checked
    setTimeout(() => {
        isDestabilized = false;
        btn.innerHTML = '<i class="bi bi-lightning-fill"></i> Destabilize System';
        btn.classList.remove('active');
        
        if (document.getElementById('autoStabilize').checked) {
            recoverSystem();
        }
    }, 15000);
    
    // Update ML analysis
    updateMachineLearningAnalysis();
    updateSystemRecommendations();
}

// Recover the system from destabilization
function recoverSystem() {
    adjustValue('voltage', 0);
    adjustValue('frequency', 0);
    
    document.getElementById('autoStabilize').checked = true;
    socket.emit('set_auto_stabilize', { enabled: true });
    
    isStabilizing = true;
    updateStabilizationStatus('Stabilization in Progress', 'bg-warning');
    
    // Simulate stabilization process
    if (stabilizationTimer) clearTimeout(stabilizationTimer);
    stabilizationTimer = setTimeout(() => {
        isStabilizing = false;
        updateStabilizationStatus('System Stabilized', 'bg-success');
        
        // Reset to monitoring state after 3 seconds
        setTimeout(() => {
            updateStabilizationStatus('System Monitoring Active', 'bg-secondary');
        }, 3000);
    }, 5000);
    
    // Update ML analysis
    updateMachineLearningAnalysis();
    updateSystemRecommendations();
}

// Update stabilization status indicator
function updateStabilizationStatus(text, className) {
    const stabilizationStatus = document.getElementById('stabilizationStatus');
    stabilizationStatus.innerHTML = `<span class="badge ${className}">${text}</span>`;
}

// Update machine learning analysis
function updateMachineLearningAnalysis() {
    // Clear any existing timer
    if (mlAnalysisTimer) clearTimeout(mlAnalysisTimer);
    
    // Calculate voltage trend
    const voltageTrend = document.getElementById('voltageTrend');
    const voltageTrendBar = document.getElementById('voltageTrendBar');
    
    // Calculate frequency trend
    const frequencyTrend = document.getElementById('frequencyTrend');
    const frequencyTrendBar = document.getElementById('frequencyTrendBar');
    
    // Set to analyzing state
    voltageTrend.textContent = 'Analyzing...';
    voltageTrend.className = 'badge bg-secondary';
    voltageTrendBar.style.width = '50%';
    voltageTrendBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    
    frequencyTrend.textContent = 'Analyzing...';
    frequencyTrend.className = 'badge bg-secondary';
    frequencyTrendBar.style.width = '50%';
    frequencyTrendBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    
    // Simulate ML analysis (would be done by the server/ML model in a real app)
    mlAnalysisTimer = setTimeout(() => {
        // Analyze voltage trend
        if (voltageData.length > 5) {
            const recentVoltage = voltageData.slice(-5);
            const voltageChanges = [];
            
            for (let i = 1; i < recentVoltage.length; i++) {
                voltageChanges.push(recentVoltage[i] - recentVoltage[i-1]);
            }
            
            const avgVoltageChange = voltageChanges.reduce((a, b) => a + b, 0) / voltageChanges.length;
            let voltageStatus, voltageClass, voltagePercent;
            
            if (Math.abs(avgVoltageChange) < 0.5) {
                voltageStatus = 'Stable';
                voltageClass = 'bg-success';
                voltagePercent = 90;
            } else if (Math.abs(avgVoltageChange) < 1.5) {
                voltageStatus = avgVoltageChange > 0 ? 'Gradually Rising' : 'Gradually Falling';
                voltageClass = 'bg-info';
                voltagePercent = 70;
            } else {
                voltageStatus = avgVoltageChange > 0 ? 'Rapidly Rising' : 'Rapidly Falling';
                voltageClass = 'bg-warning';
                voltagePercent = 40;
            }
            
            voltageTrend.textContent = voltageStatus;
            voltageTrend.className = `badge ${voltageClass}`;
            voltageTrendBar.style.width = `${voltagePercent}%`;
            voltageTrendBar.className = `progress-bar ${voltageClass}`;
        }
        
        // Analyze frequency trend
        if (frequencyData.length > 5) {
            const recentFrequency = frequencyData.slice(-5);
            const frequencyChanges = [];
            
            for (let i = 1; i < recentFrequency.length; i++) {
                frequencyChanges.push(recentFrequency[i] - recentFrequency[i-1]);
            }
            
            const avgFrequencyChange = frequencyChanges.reduce((a, b) => a + b, 0) / frequencyChanges.length;
            let frequencyStatus, frequencyClass, frequencyPercent;
            
            if (Math.abs(avgFrequencyChange) < 0.05) {
                frequencyStatus = 'Stable';
                frequencyClass = 'bg-success';
                frequencyPercent = 90;
            } else if (Math.abs(avgFrequencyChange) < 0.15) {
                frequencyStatus = avgFrequencyChange > 0 ? 'Gradually Rising' : 'Gradually Falling';
                frequencyClass = 'bg-info';
                frequencyPercent = 70;
            } else {
                frequencyStatus = avgFrequencyChange > 0 ? 'Rapidly Rising' : 'Rapidly Falling';
                frequencyClass = 'bg-warning';
                frequencyPercent = 40;
            }
            
            frequencyTrend.textContent = frequencyStatus;
            frequencyTrend.className = `badge ${frequencyClass}`;
            frequencyTrendBar.style.width = `${frequencyPercent}%`;
            frequencyTrendBar.className = `progress-bar ${frequencyClass}`;
        }
    }, 2000);
}

// Update system recommendations based on current status
function updateSystemRecommendations() {
    const recommendations = document.getElementById('systemRecommendations');
    const voltageStability = calculateStability(voltageData, 230, 5);
    const frequencyStability = calculateStability(frequencyData, 50, 0.5);
    
    let recommendationText = '';
    
    if (voltageStability < 60 || frequencyStability < 60) {
        // System is unstable
        if (!document.getElementById('autoStabilize').checked) {
            recommendationText = `
                <div class="alert alert-danger">
                    <strong>Critical Recommendation:</strong> Enable auto-stabilization immediately. 
                    The system is experiencing dangerous fluctuations that could damage equipment.
                </div>
            `;
        } else {
            recommendationText = `
                <div class="alert alert-warning">
                    <strong>Stabilization in Progress:</strong> The auto-stabilizer is working to correct significant deviations.
                    Allow system 30-60 seconds to return to normal parameters.
                </div>
            `;
        }
    } else if (voltageStability < 80 || frequencyStability < 80) {
        // System needs attention
        if (voltageStability < frequencyStability) {
            recommendationText = `
                <div class="alert alert-info">
                    <strong>Voltage Fluctuation:</strong> Consider checking voltage regulators. 
                    The system is maintaining stability but voltage variations are above optimal levels.
                </div>
            `;
        } else {
            recommendationText = `
                <div class="alert alert-info">
                    <strong>Frequency Fluctuation:</strong> Consider checking frequency control systems. 
                    The system is maintaining stability but frequency variations are above optimal levels.
                </div>
            `;
        }
    } else {
        // System is stable
        recommendationText = `
            <div class="alert alert-success">
                <strong>Optimal Operation:</strong> All parameters are within normal ranges. 
                Continuing standard monitoring procedures.
            </div>
        `;
    }
    
    recommendations.innerHTML = recommendationText;
}

// Auto-stabilization toggle handler
document.getElementById('autoStabilize').addEventListener('change', function(e) {
    socket.emit('set_auto_stabilize', {
        enabled: e.target.checked
    });
    
    if (e.target.checked && isDestabilized) {
        recoverSystem();
    }
    
    updateSystemRecommendations();
});

// Initialize ML Analysis on page load
setTimeout(updateMachineLearningAnalysis, 2000);
setTimeout(updateSystemRecommendations, 2000);