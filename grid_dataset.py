import numpy as np
import pandas as pd
from datetime import datetime
import math


class GridDataset:

    def __init__(self):
        self.nominal_voltage = 230
        self.nominal_frequency = 50
        self.data = pd.read_csv('Data/Apr_2023.csv',
                                parse_dates=True,
                                nrows=1_00_000)

        self.scenarios = {
            'normal': {
                'voltage_var': 1.5,
                'freq_var': 0.08,
                'probability': 0.65,
                'recovery_time': 2
            },
            'peak_load': {
                'voltage_var': 3.5,
                'freq_var': 0.25,
                'probability': 0.15,
                'recovery_time': 5
            },
            'renewable_fluctuation': {
                'voltage_var': 4.0,
                'freq_var': 0.3,
                'probability': 0.1,
                'recovery_time': 4
            },
            'fault': {
                'voltage_var': 8.0,
                'freq_var': 0.5,
                'probability': 0.05,
                'recovery_time': 8
            },
            'weather_impact': {
                'voltage_var': 5.0,
                'freq_var': 0.35,
                'probability': 0.05,
                'recovery_time': 6
            }
        }

        self.hour = datetime.now().hour
        self.last_event_time = datetime.now()
        self.current_scenario = 'normal'
        self.event_duration = 0
        self.weight = 0.001

    def row_generator(self):
        idx = 0
        length = len(self.data)
        while True:
            yield self.data.iloc[idx]
            idx = (idx + 1) % length

    def _apply_time_patterns(self, value, is_voltage=True):
        """Apply realistic time-based patterns to values"""
        hour = datetime.now().hour

        # Daily load curve effect (24-hour pattern)
        time_factor = math.sin(2 * math.pi * (hour - 6) / 24)  # Peak at 12-14h

        if is_voltage:
            # Voltage typically drops during peak hours
            return value - (time_factor * 2.5)
        else:
            # Frequency variations are smaller during night
            return value + (time_factor * 0.15)

    def _apply_weather_impact(self):
        """Simulate weather impacts on grid stability"""
        # Simple weather pattern simulation
        hour = datetime.now().hour
        weather_impact = math.sin(2 * math.pi * hour / 12) * 0.5
        return weather_impact

    def _get_current_scenario(self):
        if (datetime.now() -
                self.last_event_time).seconds < self.event_duration:
            return self.current_scenario

        # Time-based probabilities
        if 9 <= self.hour <= 17:  # Business hours
            scenario_weights = {
                'normal': 0.55,
                'peak_load': 0.25,
                'renewable_fluctuation': 0.1,
                'fault': 0.05,
                'weather_impact': 0.05
            }
        elif 0 <= self.hour <= 5:  # Night hours
            scenario_weights = {
                'normal': 0.8,
                'peak_load': 0.05,
                'renewable_fluctuation': 0.05,
                'fault': 0.05,
                'weather_impact': 0.05
            }
        else:  # Transition hours
            scenario_weights = {
                s: self.scenarios[s]['probability']
                for s in self.scenarios
            }

        scenarios = list(scenario_weights.keys())
        probabilities = list(scenario_weights.values())

        # Ensure probabilities sum to 1
        probabilities = np.array(probabilities)
        probabilities = probabilities / probabilities.sum()

        self.current_scenario = np.random.choice(scenarios, p=probabilities)
        self.last_event_time = datetime.now()
        self.event_duration = self.scenarios[
            self.current_scenario]['recovery_time']

        return self.current_scenario

    def generate_data_point(self):
        """Generate a realistic data point with various factors"""
        getrow = next(self.row_generator())
        baseline_voltage = getrow['MG-LV-MSB_AC_Voltage']
        baseline_frequency = getrow['MG-LV-MSB_Frequency']

        scenario = self._get_current_scenario()
        scenario_params = self.scenarios[scenario]

        # Base value generation
        voltage = np.random.normal(
            self.nominal_voltage,
            scenario_params['voltage_var']) + baseline_voltage * self.weight
        frequency = np.random.normal(
            self.nominal_frequency,
            scenario_params['freq_var']) + baseline_frequency * self.weight

        # Apply time patterns
        voltage = self._apply_time_patterns(voltage, is_voltage=True)
        frequency = self._apply_time_patterns(frequency, is_voltage=False)

        # Apply weather effects
        weather_effect = self._apply_weather_impact()
        voltage += weather_effect
        frequency += weather_effect * 0.1

        # Apply constraints
        voltage = np.clip(voltage, self.nominal_voltage - 15,
                          self.nominal_voltage + 15)
        frequency = np.clip(frequency, self.nominal_frequency - 1,
                            self.nominal_frequency + 1)

        return voltage, frequency, scenario
