import numpy as np

class DataSimulator:
    def __init__(self):
        self.nominal_voltage = 230
        self.nominal_frequency = 50
        self.voltage_variation = 5
        self.frequency_variation = 0.5
        
    def generate_data_point(self):
        """Generate a single data point for voltage and frequency"""
        voltage = np.random.normal(self.nominal_voltage, self.voltage_variation/3)
        frequency = np.random.normal(self.nominal_frequency, self.frequency_variation/3)
        
        # Clip values to ensure they're within bounds
        voltage = np.clip(voltage, 
                         self.nominal_voltage - self.voltage_variation,
                         self.nominal_voltage + self.voltage_variation)
        frequency = np.clip(frequency,
                          self.nominal_frequency - self.frequency_variation,
                          self.nominal_frequency + self.frequency_variation)
        
        return voltage, frequency
