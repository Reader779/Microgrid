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
    // Always allow destabilization (even if already destabilized)
    isDestabilized = true;
    const btn = document.getElementById('destabilizeBtn');
    btn.innerHTML = '<i class="bi bi-lightning-fill"></i> System Destabilized';
    btn.classList.add('active');
    
    // Apply moderate offsets for a noticeable but not extreme destabilization
    const moderateVoltageOffset = Math.random() > 0.5 ? 12 : -12;
    const moderateFrequencyOffset = Math.random() > 0.5 ? 0.7 : -0.7;
    
    // Force disable auto-stabilization
    document.getElementById('autoStabilize').checked = false;
    socket.emit('set_auto_stabilize', { enabled: false });
    
    // Apply the moderate values
    adjustValue('voltage', moderateVoltageOffset);
    adjustValue('frequency', moderateFrequencyOffset);
    
    updateStabilizationStatus('System Destabilized', 'bg-danger');
    
    // Update ML analysis and recommendations immediately
    updateMachineLearningAnalysis(true);
    updateSystemRecommendations(true);
    
    // Reset button after 3 seconds but keep system destabilized
    setTimeout(() => {
        isDestabilized = false;
        btn.innerHTML = '<i class="bi bi-lightning-fill"></i> Destabilize System';
        btn.classList.remove('active');
    }, 3000);
}

// Recover the system from destabilization
function recoverSystem() {
    // Calculate correction values (opposite of current offsets)
    const currentVoltage = voltageData[voltageData.length - 1] || 230;
    const currentFrequency = frequencyData[frequencyData.length - 1] || 50;
    
    // Calculate how far we are from nominal values
    const voltageCorrection = 230 - currentVoltage;
    const frequencyCorrection = 50 - currentFrequency;
    
    // Apply necessary corrections to bring system back to nominal values
    adjustValue('voltage', voltageCorrection);
    adjustValue('frequency', frequencyCorrection);
    
    // Ensure auto-stabilization is enabled
    document.getElementById('autoStabilize').checked = true;
    socket.emit('set_auto_stabilize', { enabled: true });
    
    // Update status indicators
    isStabilizing = true;
    isDestabilized = false;  // Ensure we're no longer in destabilized state
    
    // Show specific correction values in the status
    updateStabilizationStatus(`Applying Correction: V:${voltageCorrection.toFixed(1)}V, F:${frequencyCorrection.toFixed(2)}Hz`, 'bg-warning');
    
    // Short stabilization process since we've already applied corrections
    if (stabilizationTimer) clearTimeout(stabilizationTimer);
    stabilizationTimer = setTimeout(() => {
        isStabilizing = false;
        updateStabilizationStatus('System Stabilized', 'bg-success');
        
        // Reset to monitoring state after 3 seconds
        setTimeout(() => {
            updateStabilizationStatus('System Monitoring Active', 'bg-secondary');
        }, 3000);
    }, 3000);
    
    // Update ML analysis and recommendations immediately
    updateMachineLearningAnalysis(true);
    updateSystemRecommendations(true);
}

// Update stabilization status indicator
function updateStabilizationStatus(text, className) {
    const stabilizationStatus = document.getElementById('stabilizationStatus');
    stabilizationStatus.innerHTML = `<span class="badge ${className}">${text}</span>`;
}

// Update machine learning analysis
function updateMachineLearningAnalysis(immediate = false) {
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
    
    // Function to perform the analysis
    const performAnalysis = () => {
        // Handle the case when there's insufficient data (always show analysis)
        if (voltageData.length < 5) {
            voltageTrend.textContent = 'Insufficient Data';
            voltageTrend.className = 'badge bg-info';
            voltageTrendBar.style.width = '50%';
            voltageTrendBar.className = 'progress-bar bg-info';
        } else {
            // Analyze voltage trend
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
            
            // If destabilized, show moderate warning
            if (isDestabilized) {
                voltageStatus = 'Fluctuating';
                voltageClass = 'bg-warning';
                voltagePercent = 45;
            }
            
            voltageTrend.textContent = voltageStatus;
            voltageTrend.className = `badge ${voltageClass}`;
            voltageTrendBar.style.width = `${voltagePercent}%`;
            voltageTrendBar.className = `progress-bar ${voltageClass}`;
        }
        
        // Handle the case when there's insufficient data (always show analysis)
        if (frequencyData.length < 5) {
            frequencyTrend.textContent = 'Insufficient Data';
            frequencyTrend.className = 'badge bg-info';
            frequencyTrendBar.style.width = '50%';
            frequencyTrendBar.className = 'progress-bar bg-info';
        } else {
            // Analyze frequency trend
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
            
            // If destabilized, show moderate warning
            if (isDestabilized) {
                frequencyStatus = 'Fluctuating';
                frequencyClass = 'bg-warning';
                frequencyPercent = 45;
            }
            
            frequencyTrend.textContent = frequencyStatus;
            frequencyTrend.className = `badge ${frequencyClass}`;
            frequencyTrendBar.style.width = `${frequencyPercent}%`;
            frequencyTrendBar.className = `progress-bar ${frequencyClass}`;
        }
    };
    
    // Either perform analysis immediately or after a short delay
    if (immediate) {
        performAnalysis();
    } else {
        mlAnalysisTimer = setTimeout(performAnalysis, 500); // Reduced from 2000ms to 500ms
    }
}

// Update system recommendations based on current status
function updateSystemRecommendations(immediate = false) {
    const recommendations = document.getElementById('systemRecommendations');
    const voltageStability = calculateStability(voltageData, 230, 5);
    const frequencyStability = calculateStability(frequencyData, 50, 0.5);
    
    let recommendationText = '';
    
    // Calculate required manual adjustments
    const currentVoltage = voltageData[voltageData.length - 1] || 230;
    const currentFrequency = frequencyData[frequencyData.length - 1] || 50;
    const voltageCorrection = (230 - currentVoltage).toFixed(1);
    const frequencyCorrection = (50 - currentFrequency).toFixed(2);
    const voltageDirection = voltageCorrection > 0 ? "increase" : "decrease";
    const frequencyDirection = frequencyCorrection > 0 ? "increase" : "decrease";
    
    // Show professional alert if the system was destabilized
    if (isDestabilized) {
        recommendationText = `
            <div class="alert alert-warning">
                <strong>System Alert:</strong> Significant voltage and frequency fluctuations detected 
                <ul>
                    <li>Action recommended to maintain system integrity</li>
                    <li>Enable auto-stabilization for optimal recovery</li>
                    <li>Monitor system parameters during stabilization</li>
                    <li>Check for potential external interference sources</li>
                </ul>
                <strong>Manual Stabilization Values:</strong>
                <ul>
                    <li>${voltageDirection} voltage by ${Math.abs(voltageCorrection)}V</li>
                    <li>${frequencyDirection} frequency by ${Math.abs(frequencyCorrection)}Hz</li>
                </ul>
                <strong>AI Recommendation:</strong> Enable auto-stabilization to return to normal parameters.
            </div>
        `;
    }
    // Use regular recommendation logic if not explicitly destabilized
    else if (voltageStability < 60 || frequencyStability < 60) {
        // System is unstable
        if (!document.getElementById('autoStabilize').checked) {
            recommendationText = `
                <div class="alert alert-danger">
                    <strong>Critical Recommendation:</strong> Enable auto-stabilization immediately. 
                    <p>The system is experiencing dangerous fluctuations that could damage equipment.</p>
                    <strong>Manual Stabilization Actions Needed:</strong>
                    <ul>
                        <li>${voltageDirection} voltage by ${Math.abs(voltageCorrection)}V</li>
                        <li>${frequencyDirection} frequency by ${Math.abs(frequencyCorrection)}Hz</li>
                    </ul>
                    <strong>AI Analysis:</strong> System instability detected in ${voltageStability < frequencyStability ? 'voltage' : 'frequency'} parameters. 
                    Risk of equipment failure increases by 5% every minute stabilization is disabled.
                </div>
            `;
        } else {
            recommendationText = `
                <div class="alert alert-warning">
                    <strong>Stabilization in Progress:</strong> The auto-stabilizer is working to correct significant deviations.
                    <p>Allow system 30-60 seconds to return to normal parameters.</p>
                    <strong>Auto-Stabilizer Adjustments:</strong>
                    <ul>
                        <li>Applying ${voltageDirection} voltage: ${Math.abs(voltageCorrection)}V</li>
                        <li>Applying ${frequencyDirection} frequency: ${Math.abs(frequencyCorrection)}Hz</li>
                    </ul>
                    <strong>AI Analysis:</strong> Correction algorithms active. 
                    Estimated recovery time: ${Math.round(120 - voltageStability - frequencyStability)} seconds.
                </div>
            `;
        }
    } else if (voltageStability < 80 || frequencyStability < 80) {
        // System needs attention
        if (voltageStability < frequencyStability) {
            recommendationText = `
                <div class="alert alert-info">
                    <strong>Voltage Fluctuation:</strong> Consider checking voltage regulators. 
                    <p>The system is maintaining stability but voltage variations are above optimal levels.</p>
                    <strong>AI Analysis:</strong> Pattern suggests potential voltage regulator wear. 
                    Recommend scheduled maintenance within next 30 days.
                </div>
            `;
        } else {
            recommendationText = `
                <div class="alert alert-info">
                    <strong>Frequency Fluctuation:</strong> Consider checking frequency control systems. 
                    <p>The system is maintaining stability but frequency variations are above optimal levels.</p>
                    <strong>AI Analysis:</strong> Frequency oscillation patterns indicate possible generator 
                    synchronization issue. Recommend calibration check.
                </div>
            `;
        }
    } else {
        // System is stable
        recommendationText = `
            <div class="alert alert-success">
                <strong>Optimal Operation:</strong> All parameters are within normal ranges. 
                <p>Continuing standard monitoring procedures.</p>
                <strong>AI Analysis:</strong> System operating at ${Math.round((voltageStability + frequencyStability) / 2)}% efficiency. 
                No immediate action required.
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

// Initialize ML Analysis on page load (immediately)
updateMachineLearningAnalysis(true); // Force immediate analysis
updateSystemRecommendations(true);   // Force immediate recommendations

// Set up periodic updates at a moderate, professional pace
setInterval(() => {
    updateMachineLearningAnalysis(true);
    updateSystemRecommendations(true);
}, 8000); // Update every 8 seconds for a more professional pace