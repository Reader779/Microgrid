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

@app.route('/')
def index():
    return render_template('index.html')

def background_task():
    """Background task to generate and process data"""
    global voltage_offset, frequency_offset

    while True:
        # Generate new data point with manual adjustments
        base_voltage, base_frequency = data_simulator.generate_data_point()
        voltage = base_voltage + voltage_offset
        frequency = base_frequency + frequency_offset

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
            else:
                v_action = "Manual Control"
                f_action = "Manual Control"

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
    global voltage_offset, frequency_offset, auto_stabilize

    if data['type'] == 'voltage':
        voltage_offset = data['value']
    else:
        frequency_offset = data['value']

    auto_stabilize = data['auto_stabilize']
    logging.debug(f'Manual adjustment: {data}')

@socketio.on('set_auto_stabilize')
def handle_auto_stabilize(data):
    global auto_stabilize
    auto_stabilize = data['enabled']
    logging.debug(f'Auto-stabilize set to: {auto_stabilize}')

if __name__ == '__main__':
    socketio.start_background_task(background_task)
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)