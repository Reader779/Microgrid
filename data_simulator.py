
from grid_dataset import GridDataset
import numpy as np

class DataSimulator:
    def __init__(self):
        self.dataset = GridDataset()
        self.current_scenario = 'normal'
        self.stability_history = []
        self.max_history = 100
        
    def generate_data_point(self):
        """Generate a single data point with stability tracking"""
        voltage, frequency, scenario = self.dataset.generate_data_point()
        self.current_scenario = scenario
        
        voltage_deviation = abs(voltage - self.dataset.nominal_voltage)
        freq_deviation = abs(frequency - self.dataset.nominal_frequency)
        
        stability_score = 1.0 - (voltage_deviation / 15 + freq_deviation)
        self.stability_history.append(stability_score)
        if len(self.stability_history) > self.max_history:
            self.stability_history.pop(0)
            
        return voltage, frequency
        
    def get_stability_trend(self):
        """Calculate stability trend over time"""
        if len(self.stability_history) < 2:
            return 0
        return np.mean(np.diff(self.stability_history[-10:]))
