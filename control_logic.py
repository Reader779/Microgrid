class ControlLogic:

    def __init__(self):
        self.nominal_voltage = 230
        self.nominal_frequency = 50
        self.voltage_tolerance = 5
        self.frequency_tolerance = 0.5

    def get_voltage_action(self, predicted_voltage):
        """Determine control action for voltage"""
        if predicted_voltage > self.nominal_voltage + self.voltage_tolerance:
            return "Decrease Volt"
        elif predicted_voltage < self.nominal_voltage - self.voltage_tolerance:
            return "Increase Volt"
        return "No Action Needed"

    def get_frequency_action(self, predicted_frequency):
        """Determine control action for frequency"""
        if predicted_frequency > self.nominal_frequency + self.frequency_tolerance:
            return "Decrease Freq"
        elif predicted_frequency < self.nominal_frequency - self.frequency_tolerance:
            return "Increase Freq"
        return "No Action Needed"
