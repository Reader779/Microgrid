from datetime import datetime
from app import db

class MeasurementRecord(db.Model):
    """Model for storing voltage and frequency measurements"""
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    voltage = db.Column(db.Float, nullable=False)
    frequency = db.Column(db.Float, nullable=False)
    predicted_voltage = db.Column(db.Float, nullable=False)
    predicted_frequency = db.Column(db.Float, nullable=False)
    voltage_action = db.Column(db.String(20), nullable=False)
    frequency_action = db.Column(db.String(20), nullable=False)

    def __repr__(self):
        return f'<MeasurementRecord {self.timestamp}: V={self.voltage:.2f}V, F={self.frequency:.2f}Hz>'

    def to_dict(self):
        """Convert record to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'voltage': self.voltage,
            'frequency': self.frequency,
            'predicted_voltage': self.predicted_voltage,
            'predicted_frequency': self.predicted_frequency,
            'voltage_action': self.voltage_action,
            'frequency_action': self.frequency_action
        }

class ModelParameters(db.Model):
    """Model for storing LSTM model parameters"""
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    parameter_type = db.Column(db.String(50), nullable=False)  # 'voltage' or 'frequency'
    model_state = db.Column(db.LargeBinary, nullable=False)  # Serialized PyTorch state dict
    performance_metric = db.Column(db.Float)  # e.g., validation loss
    
    def __repr__(self):
        return f'<ModelParameters {self.parameter_type} at {self.timestamp}>'

class SystemConfig(db.Model):
    """Model for storing system configuration parameters"""
    id = db.Column(db.Integer, primary_key=True)
    nominal_voltage = db.Column(db.Float, nullable=False, default=230.0)
    nominal_frequency = db.Column(db.Float, nullable=False, default=50.0)
    voltage_tolerance = db.Column(db.Float, nullable=False, default=5.0)
    frequency_tolerance = db.Column(db.Float, nullable=False, default=0.5)
    sequence_length = db.Column(db.Integer, nullable=False, default=10)
    update_interval = db.Column(db.Float, nullable=False, default=1.0)  # seconds
    last_updated = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f'<SystemConfig id={self.id} updated={self.last_updated}>'

    def to_dict(self):
        """Convert configuration to dictionary"""
        return {
            'nominal_voltage': self.nominal_voltage,
            'nominal_frequency': self.nominal_frequency,
            'voltage_tolerance': self.voltage_tolerance,
            'frequency_tolerance': self.frequency_tolerance,
            'sequence_length': self.sequence_length,
            'update_interval': self.update_interval
        }
