
from grid_dataset import GridDataset
import numpy as np

class DataSimulator:
    def __init__(self):
        self.dataset = GridDataset()
        self.current_scenario = 'normal'
        
    def generate_data_point(self):
        """Generate a single data point for voltage and frequency"""
        voltage, frequency, scenario = self.dataset.generate_data_point()
        self.current_scenario = scenario
        return voltage, frequency
