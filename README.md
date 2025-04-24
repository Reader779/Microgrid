# Microgrid Stabilization Simulator

This project simulates a real-time microgrid voltage and frequency stabilization system using Flask, PyTorch LSTM for prediction, and WebSockets for real-time data transmission.

## Features

- Real-time voltage and frequency monitoring
- LSTM-based machine learning prediction of future values
- Automatic stabilization control logic
- Interactive control panel to adjust system parameters
- Advanced data visualization and analysis
- Machine learning trend analysis
- System recommendations based on data patterns

## Machine Learning Components

The application uses Long Short-Term Memory (LSTM) neural networks to:
- Predict future voltage and frequency values based on time-series data
- Analyze trends and patterns in system behavior
- Provide recommendations for optimal system management
- Detect anomalies and potential instabilities before they become critical

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Required Python Packages

- Flask
- Flask-SocketIO
- PyTorch
- NumPy
- python-socketio
- gunicorn (for production deployment)

## Installation and Setup

1. Clone the repository to your local machine:
```bash
git clone <repository-url>
cd microgrid-simulator
```

2. Set up a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install the required packages:
```bash
pip install flask flask-socketio torch numpy python-socketio gunicorn
```

## Running the Application

1. Start the Flask application:
```bash
python main.py
```

2. Open your web browser and navigate to:
```
http://localhost:5000
```

## Usage Guide

- **Monitor System**: The dashboard displays real-time voltage and frequency data.
- **Control Parameters**: Use the control panel to adjust voltage and frequency offsets.
- **Toggle Auto-Stabilization**: Enable or disable the automatic stabilization system.
- **Test System Resilience**: Use the "Destabilize System" button to introduce random fluctuations.
- **Custom Adjustments**: Fine-tune voltage and frequency with custom increment controls.
- **System Analysis**: View machine learning analysis of system trends and receive AI-generated recommendations.

## System Architecture

- **Frontend**: HTML, CSS (Bootstrap), JavaScript with Chart.js for visualization
- **Backend**: Flask Python web server
- **Real-time Communication**: Flask-SocketIO for WebSocket connections
- **Machine Learning**: PyTorch LSTM models for prediction and analysis
- **Data Simulation**: Python-based simulation of microgrid data

## Extending the Project

The simulator can be extended with:
- Additional sensor data inputs
- More complex neural network models
- Integration with real hardware through APIs
- Multi-node microgrid simulation
- Load balancing algorithms
- Fault detection and recovery systems