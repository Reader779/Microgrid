from flask import Flask, render_template
from flask_socketio import SocketIO
import torch
import numpy as np
import logging
import time
from data_simulator import DataSimulator
from lstm_model import LSTMPredictor
from control_logic import ControlLogic

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'microgrid-secret'
socketio = SocketIO(app)

# Initialize components
data_simulator = DataSimulator()
lstm_model = LSTMPredictor()
control_logic = ControlLogic()

# Global variables
SEQUENCE_LENGTH = 10
voltage_sequence = []
frequency_sequence = []
voltage_offset = 0
frequency_offset = 0
auto_stabilize = True
NOMINAL_VOLTAGE = 230.0
NOMINAL_FREQUENCY = 50.0
stabilize_enabled = True  # Flag to control continuous stabilization
perfect_stabilization = False  # Flag to toggle between standard vs perfect stabilization

@app.route('/')
def index():
    return render_template('index.html')

def background_task():
    """Background task to generate and process data"""
    global voltage_offset, frequency_offset

    while True:
        # Generate new data point with manual adjustments
        base_voltage, base_frequency = data_simulator.generate_data_point()
        
        # Perfect stabilization mode forces exact nominal values
        if perfect_stabilization and auto_stabilize and stabilize_enabled:
            # In perfect mode, we directly use the nominal values, ignoring the base values
            voltage = NOMINAL_VOLTAGE
            frequency = NOMINAL_FREQUENCY
            voltage_deviation = 0
            frequency_deviation = 0
            # Reset offsets since we're forcing perfect values
            voltage_offset = 0
            frequency_offset = 0
        else:
            # Normal mode with fluctuations
            voltage = base_voltage + voltage_offset
            frequency = base_frequency + frequency_offset
            # Calculate how far we are from nominal values
            voltage_deviation = NOMINAL_VOLTAGE - voltage
            frequency_deviation = NOMINAL_FREQUENCY - frequency
            
            # Apply automatic stabilization if enabled (standard mode)
            if auto_stabilize and stabilize_enabled:
                # Apply gradual corrections (5% per cycle)
                voltage_correction = voltage_deviation * 0.05
                frequency_correction = frequency_deviation * 0.05
                
                # Update offsets to stabilize the system
                voltage_offset += voltage_correction
                frequency_offset += frequency_correction
                
                # Log significant corrections
                if abs(voltage_correction) > 0.5 or abs(frequency_correction) > 0.05:
                    logging.debug(f"Auto-stabilizing: V:{voltage_correction:.2f}, F:{frequency_correction:.2f}")

        # Update sequences
        voltage_sequence.append(voltage)
        frequency_sequence.append(frequency)
        if len(voltage_sequence) > SEQUENCE_LENGTH:
            voltage_sequence.pop(0)
            frequency_sequence.pop(0)

        if len(voltage_sequence) == SEQUENCE_LENGTH:
            # Prepare input for LSTM
            v_seq = torch.FloatTensor(voltage_sequence).view(1, -1, 1)
            f_seq = torch.FloatTensor(frequency_sequence).view(1, -1, 1)

            # Get predictions
            next_voltage = lstm_model.predict(v_seq)
            next_frequency = lstm_model.predict(f_seq)

            # Get control actions based on auto-stabilize setting
            if auto_stabilize:
                v_action = control_logic.get_voltage_action(next_voltage)
                f_action = control_logic.get_frequency_action(next_frequency)
                
                # Add more specific actions when auto-stabilizing
                if abs(voltage_deviation) > 1.0:
                    if voltage_deviation > 0:
                        v_action = f"Increase Volt ({voltage_deviation:.1f}V)"
                    else:
                        v_action = f"Decrease Volt ({-voltage_deviation:.1f}V)"
                    
                if abs(frequency_deviation) > 0.1:
                    if frequency_deviation > 0:
                        f_action = f"Increase Freq ({frequency_deviation:.2f}Hz)"
                    else:
                        f_action = f"Decrease Freq ({-frequency_deviation:.2f}Hz)"
            else:
                # More helpful manual control recommendations
                v_action = f"Manual Control (Needs {voltage_deviation:.1f}V)"
                f_action = f"Manual Control (Needs {frequency_deviation:.2f}Hz)"

            # Emit data to clients
            socketio.emit('update_data', {
                'voltage': voltage,
                'frequency': frequency,
                'predicted_voltage': float(next_voltage),
                'predicted_frequency': float(next_frequency),
                'voltage_action': v_action,
                'frequency_action': f_action,
                'timestamp': time.time()
            })

        time.sleep(1)

@socketio.on('connect')
def handle_connect():
    logging.debug('Client connected')

@socketio.on('manual_adjustment')
def handle_manual_adjustment(data):
    global voltage_offset, frequency_offset, auto_stabilize, stabilize_enabled

    if data['type'] == 'voltage':
        voltage_offset = data['value']
    else:
        frequency_offset = data['value']

    auto_stabilize = data['auto_stabilize']
    
    # Pause stabilization for 3 seconds when manual adjustment is made
    # to allow the user to see the effect of their change
    stabilize_enabled = False
    logging.debug(f'Manual adjustment: {data}, temporarily pausing stabilization')
    
    # Re-enable stabilization after 3 seconds if auto-stabilize is on
    if auto_stabilize:
        def resume_stabilization():
            global stabilize_enabled
            time.sleep(3)  # Wait for 3 seconds
            stabilize_enabled = True
            logging.debug('Stabilization resumed')
        
        socketio.start_background_task(target=resume_stabilization)

@socketio.on('set_auto_stabilize')
def handle_auto_stabilize(data):
    global auto_stabilize, stabilize_enabled
    auto_stabilize = data['enabled']
    stabilize_enabled = True  # Always enable stabilization when toggling
    
    # Clear any manual offsets when auto-stabilize is enabled
    if auto_stabilize:
        def smooth_reset():
            global voltage_offset, frequency_offset
            steps = 10
            v_step = voltage_offset / steps
            f_step = frequency_offset / steps
            
            for _ in range(steps):
                if not auto_stabilize:  # Stop if auto-stabilize was turned off
                    break
                voltage_offset -= v_step
                frequency_offset -= f_step
                time.sleep(0.3)
            
            # Final reset to ensure precision
            if auto_stabilize:
                voltage_offset = 0
                frequency_offset = 0
                
        socketio.start_background_task(smooth_reset)
    
    logging.debug(f'Auto-stabilize set to: {auto_stabilize}')

@socketio.on('set_stabilization_mode')
def handle_stabilization_mode(data):
    global perfect_stabilization
    perfect_stabilization = data['perfect_mode']
    logging.debug(f'Perfect stabilization mode set to: {perfect_stabilization}')

if __name__ == '__main__':
    socketio.start_background_task(background_task)
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)