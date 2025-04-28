
import numpy as np
from datetime import datetime, timedelta

class GridDataset:
    def __init__(self):
        # Base nominal values
        self.nominal_voltage = 230
        self.nominal_frequency = 50
        
        # Define different grid scenarios
        self.scenarios = {
            'normal': {
                'voltage_var': 2,
                'freq_var': 0.1,
                'probability': 0.7
            },
            'peak_load': {
                'voltage_var': 4,
                'freq_var': 0.3,
                'probability': 0.15
            },
            'low_load': {
                'voltage_var': 3,
                'freq_var': 0.2,
                'probability': 0.1
            },
            'fault': {
                'voltage_var': 8,
                'freq_var': 0.5,
                'probability': 0.05
            }
        }
        
        # Time-based patterns
        self.hour = datetime.now().hour
        
    def _get_current_scenario(self):
        # Add time-based bias
        if 9 <= self.hour <= 17:  # Peak hours
            self.scenarios['peak_load']['probability'] = 0.25
            self.scenarios['normal']['probability'] = 0.6
        elif 0 <= self.hour <= 5:  # Night hours
            self.scenarios['low_load']['probability'] = 0.2
            self.scenarios['normal']['probability'] = 0.7
            
        # Select scenario based on probability
        scenarios = list(self.scenarios.keys())
        probabilities = [self.scenarios[s]['probability'] for s in scenarios]
        return np.random.choice(scenarios, p=probabilities)
        
    def generate_data_point(self):
        scenario = self._get_current_scenario()
        scenario_params = self.scenarios[scenario]
        
        # Generate base values with scenario-specific variation
        voltage = np.random.normal(self.nominal_voltage, scenario_params['voltage_var'])
        frequency = np.random.normal(self.nominal_frequency, scenario_params['freq_var'])
        
        # Apply constraints
        voltage = np.clip(voltage, self.nominal_voltage - 15, self.nominal_voltage + 15)
        frequency = np.clip(frequency, self.nominal_frequency - 1, self.nominal_frequency + 1)
        
        return voltage, frequency, scenario
