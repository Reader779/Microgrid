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
    // Check if we're in perfect mode - can't destabilize in perfect mode
    if (document.getElementById('perfectMode').checked) {
        // Show a warning message
        updateStabilizationStatus('Cannot destabilize in Perfect Mode', 'bg-warning');
        setTimeout(() => {
            updateStabilizationStatus('Perfect Stability Active', 'bg-success');
        }, 3000);
        return;
    }
    
    // Check current state for progressive destabilization
    const currentVoltage = voltageData[voltageData.length - 1] || 230;
    const currentFrequency = frequencyData[frequencyData.length - 1] || 50;
    const voltageDeviation = Math.abs(230 - currentVoltage);
    const frequencyDeviation = Math.abs(50 - currentFrequency);
    
    // Set to destabilized state 
    isDestabilized = true;
    const btn = document.getElementById('destabilizeBtn');
    btn.innerHTML = '<i class="bi bi-lightning-fill"></i> System Destabilized';
    btn.classList.add('active');
    
    // Enable the immediate stabilize button
    document.getElementById('immediateStabilizeBtn').disabled = false;
    
    // Force disable auto-stabilization first
    document.getElementById('autoStabilize').checked = false;
    socket.emit('set_auto_stabilize', { enabled: false });
    
    // Make sure we're in standard mode (not perfect)
    document.getElementById('standardMode').checked = true;
    socket.emit('set_stabilization_mode', { perfect_mode: false });
    
    // If system already has significant deviations, apply different pattern
    if (voltageDeviation > 5 || frequencyDeviation > 0.3) {
        // Apply more extreme offsets if already destabilized
        // Use opposite direction from current deviation to create oscillation
        const voltageDir = currentVoltage > 230 ? -1 : 1;
        const frequencyDir = currentFrequency > 50 ? -1 : 1;
        
        const extremeVoltageOffset = (8 + Math.random() * 7) * voltageDir; // 8-15V in opposite direction
        const extremeFrequencyOffset = (0.6 + Math.random() * 0.4) * frequencyDir; // 0.6-1.0Hz in opposite direction
        
        // Apply the more extreme values
        adjustValue('voltage', extremeVoltageOffset);
        adjustValue('frequency', extremeFrequencyOffset);
        
        updateStabilizationStatus('Critical System Fluctuation', 'bg-danger');
    } else {
        // Initial moderate destabilization
        const moderateVoltageOffset = Math.random() > 0.5 ? 12 : -12;
        const moderateFrequencyOffset = Math.random() > 0.5 ? 0.7 : -0.7;
        
        // Apply the moderate values
        adjustValue('voltage', moderateVoltageOffset);
        adjustValue('frequency', moderateFrequencyOffset);
        
        updateStabilizationStatus('System Destabilized', 'bg-danger');
    }
    
    // Update ML analysis and recommendations immediately
    updateMachineLearningAnalysis(true);
    updateSystemRecommendations(true);
    
    // Reset button after 3 seconds but keep system destabilized state
    setTimeout(() => {
        btn.innerHTML = '<i class="bi bi-lightning-fill"></i> Destabilize System';
        btn.classList.remove('active');
    }, 3000);
}

// Immediate stabilization function - instantly corrects system to nominal values
function immediateStabilize() {
    // Only works if system is destabilized
    if (!isDestabilized) {
        return;
    }
    
    // Get the current values
    const currentVoltage = voltageData[voltageData.length - 1] || 230;
    const currentFrequency = frequencyData[frequencyData.length - 1] || 50;
    
    // Calculate exact corrections needed to return to nominal values
    const voltageCorrection = 230 - currentVoltage;
    const frequencyCorrection = 50 - currentFrequency;
    
    // Apply immediate corrections
    adjustValue('voltage', voltageCorrection);
    adjustValue('frequency', frequencyCorrection);
    
    // Set the auto-stabilization to enabled
    document.getElementById('autoStabilize').checked = true;
    socket.emit('set_auto_stabilize', { enabled: true });
    
    // Update status indicators
    isDestabilized = false;
    isStabilizing = false;
    
    // Ask if user wants perfect stabilization after immediate stabilization
    const perfectModePrompt = confirm("Would you like to enable Perfect Stabilization Mode for continuous perfect stability?");
    
    if (perfectModePrompt) {
        // Enable perfect mode
        document.getElementById('perfectMode').checked = true;
        socket.emit('set_stabilization_mode', { perfect_mode: true });
        
        // Update UI elements
        updateStabilizationStatus('Perfect Stabilization Enabled', 'bg-success');
        document.getElementById('destabilizeBtn').disabled = true;
    } else {
        // Stay in standard mode
        document.getElementById('standardMode').checked = true;
        socket.emit('set_stabilization_mode', { perfect_mode: false });
        
        // Update UI elements
        updateStabilizationStatus('Immediate Stabilization Applied', 'bg-success');
    }
    
    // Disable immediate stabilize button
    document.getElementById('immediateStabilizeBtn').disabled = true;
    
    // Visual feedback on the button
    const btn = document.getElementById('immediateStabilizeBtn');
    btn.classList.add('active');
    
    // Update ML analysis and recommendations immediately
    updateMachineLearningAnalysis(true);
    updateSystemRecommendations(true);
    
    // Reset button appearance after 2 seconds
    setTimeout(() => {
        btn.classList.remove('active');
        
        if (document.getElementById('perfectMode').checked) {
            updateStabilizationStatus('Perfect Stability Active', 'bg-success');
        } else {
            updateStabilizationStatus('System Stabilized', 'bg-success');
            
            // Reset to monitoring state after another 2 seconds
            setTimeout(() => {
                updateStabilizationStatus('System Monitoring Active', 'bg-secondary');
            }, 2000);
        }
    }, 2000);
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
    
    // Disable the immediate stabilize button since we're recovering
    document.getElementById('immediateStabilizeBtn').disabled = true;
    
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

// Store the last analysis results to avoid flickering
let lastVoltageAnalysis = { status: null, class: null, percent: null };
let lastFrequencyAnalysis = { status: null, class: null, percent: null };

// Update machine learning analysis
function updateMachineLearningAnalysis(immediate = false) {
    // Clear any existing timer
    if (mlAnalysisTimer) clearTimeout(mlAnalysisTimer);
    
    // Get DOM elements
    const voltageTrend = document.getElementById('voltageTrend');
    const voltageTrendBar = document.getElementById('voltageTrendBar');
    const frequencyTrend = document.getElementById('frequencyTrend');
    const frequencyTrendBar = document.getElementById('frequencyTrendBar');
    
    // Function to perform the analysis
    const performAnalysis = () => {
        // Analyze voltage trend
        if (voltageData.length < 5) {
            lastVoltageAnalysis = {
                status: 'Insufficient Data',
                class: 'bg-info',
                percent: 50
            };
        } else {
            // Analyze voltage trend
            const recentVoltage = voltageData.slice(-5);
            const voltageChanges = [];
            
            for (let i = 1; i < recentVoltage.length; i++) {
                voltageChanges.push(recentVoltage[i] - recentVoltage[i-1]);
            }
            
            const avgVoltageChange = voltageChanges.reduce((a, b) => a + b, 0) / voltageChanges.length;
            const currentVoltage = voltageData[voltageData.length - 1] || 230;
            const voltageDeviation = Math.abs(230 - currentVoltage);
            
            // Check for edge cases - large manual adjustments
            if (voltageDeviation > 15) {
                lastVoltageAnalysis = {
                    status: 'Critical Deviation',
                    class: 'bg-danger',
                    percent: 20
                };
            } else if (Math.abs(avgVoltageChange) < 0.5) {
                lastVoltageAnalysis = {
                    status: 'Stable',
                    class: 'bg-success',
                    percent: 90
                };
            } else if (Math.abs(avgVoltageChange) < 1.5) {
                lastVoltageAnalysis = {
                    status: avgVoltageChange > 0 ? 'Gradually Rising' : 'Gradually Falling',
                    class: 'bg-info',
                    percent: 70
                };
            } else {
                lastVoltageAnalysis = {
                    status: avgVoltageChange > 0 ? 'Rapidly Rising' : 'Rapidly Falling',
                    class: 'bg-warning',
                    percent: 40
                };
            }
            
            // If destabilized, show moderate warning
            if (isDestabilized) {
                lastVoltageAnalysis = {
                    status: 'Fluctuating',
                    class: 'bg-warning',
                    percent: 45
                };
            }
        }
        
        // Analyze frequency trend
        if (frequencyData.length < 5) {
            lastFrequencyAnalysis = {
                status: 'Insufficient Data',
                class: 'bg-info',
                percent: 50
            };
        } else {
            // Analyze frequency trend
            const recentFrequency = frequencyData.slice(-5);
            const frequencyChanges = [];
            
            for (let i = 1; i < recentFrequency.length; i++) {
                frequencyChanges.push(recentFrequency[i] - recentFrequency[i-1]);
            }
            
            const avgFrequencyChange = frequencyChanges.reduce((a, b) => a + b, 0) / frequencyChanges.length;
            const currentFrequency = frequencyData[frequencyData.length - 1] || 50;
            const frequencyDeviation = Math.abs(50 - currentFrequency);
            
            // Check for edge cases - large manual adjustments
            if (frequencyDeviation > 2) {
                lastFrequencyAnalysis = {
                    status: 'Critical Deviation',
                    class: 'bg-danger',
                    percent: 20
                };
            } else if (Math.abs(avgFrequencyChange) < 0.05) {
                lastFrequencyAnalysis = {
                    status: 'Stable',
                    class: 'bg-success',
                    percent: 90
                };
            } else if (Math.abs(avgFrequencyChange) < 0.15) {
                lastFrequencyAnalysis = {
                    status: avgFrequencyChange > 0 ? 'Gradually Rising' : 'Gradually Falling',
                    class: 'bg-info',
                    percent: 70
                };
            } else {
                lastFrequencyAnalysis = {
                    status: avgFrequencyChange > 0 ? 'Rapidly Rising' : 'Rapidly Falling',
                    class: 'bg-warning',
                    percent: 40
                };
            }
            
            // If destabilized, show moderate warning
            if (isDestabilized) {
                lastFrequencyAnalysis = {
                    status: 'Fluctuating',
                    class: 'bg-warning',
                    percent: 45
                };
            }
        }
        
        // Update the UI with the analysis results
        updateAnalysisDisplay();
    };
    
    // Function to update display with last analysis results
    function updateAnalysisDisplay() {
        // Only update if we have analysis results
        if (lastVoltageAnalysis.status) {
            voltageTrend.textContent = lastVoltageAnalysis.status;
            voltageTrend.className = `badge ${lastVoltageAnalysis.class}`;
            voltageTrendBar.style.width = `${lastVoltageAnalysis.percent}%`;
            voltageTrendBar.className = `progress-bar ${lastVoltageAnalysis.class}`;
        }
        
        if (lastFrequencyAnalysis.status) {
            frequencyTrend.textContent = lastFrequencyAnalysis.status;
            frequencyTrend.className = `badge ${lastFrequencyAnalysis.class}`;
            frequencyTrendBar.style.width = `${lastFrequencyAnalysis.percent}%`;
            frequencyTrendBar.className = `progress-bar ${lastFrequencyAnalysis.class}`;
        }
    }
    
    // If we have previous analysis, show it first to avoid flicker
    if (lastVoltageAnalysis.status && lastFrequencyAnalysis.status) {
        updateAnalysisDisplay();
    } else {
        // For initial analysis, show analyzing state
        voltageTrend.textContent = 'Analyzing...';
        voltageTrend.className = 'badge bg-secondary';
        voltageTrendBar.style.width = '50%';
        voltageTrendBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
        
        frequencyTrend.textContent = 'Analyzing...';
        frequencyTrend.className = 'badge bg-secondary';
        frequencyTrendBar.style.width = '50%';
        frequencyTrendBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    }
    
    // Either perform analysis immediately or after a short delay
    if (immediate) {
        performAnalysis();
    } else {
        mlAnalysisTimer = setTimeout(performAnalysis, 500);
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

// Stabilization mode radio buttons handlers
document.getElementById('standardMode').addEventListener('change', function() {
    if (this.checked) {
        socket.emit('set_stabilization_mode', {
            perfect_mode: false
        });
        updateStabilizationStatus('Standard Stabilization Mode', 'bg-secondary');
        
        // After a moment, revert to normal status display
        setTimeout(() => {
            if (!isDestabilized && !isStabilizing) {
                updateStabilizationStatus('System Monitoring Active', 'bg-secondary');
            }
        }, 3000);
    }
});

document.getElementById('perfectMode').addEventListener('change', function() {
    if (this.checked) {
        socket.emit('set_stabilization_mode', {
            perfect_mode: true
        });
        updateStabilizationStatus('Perfect Stabilization Mode', 'bg-success');
        
        // If auto-stabilize is not enabled, suggest enabling it
        if (!document.getElementById('autoStabilize').checked) {
            // Show a notification
            const recommendations = document.getElementById('systemRecommendations');
            recommendations.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Mode Conflict:</strong> Perfect stabilization requires auto-stabilization.
                    <p>Please enable auto-stabilization for perfect mode to work.</p>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('autoStabilize').click()">
                        Enable Auto-stabilization
                    </button>
                </div>
            `;
        }
        
        // Disable the destabilize button in perfect mode
        document.getElementById('destabilizeBtn').disabled = true;
        
        // After a few seconds, revert to normal status display but keep success color
        setTimeout(() => {
            if (!isDestabilized && !isStabilizing) {
                updateStabilizationStatus('Perfect Stability Active', 'bg-success');
            }
        }, 3000);
    } else {
        // Re-enable the destabilize button when not in perfect mode
        document.getElementById('destabilizeBtn').disabled = false;
    }
});

// Initialize ML Analysis on page load (immediately)
updateMachineLearningAnalysis(true); // Force immediate analysis
updateSystemRecommendations(true);   // Force immediate recommendations

// Set up periodic updates at a moderate, professional pace
setInterval(() => {
    updateMachineLearningAnalysis(true);
    updateSystemRecommendations(true);
}, 8000); // Update every 8 seconds for a more professional pace