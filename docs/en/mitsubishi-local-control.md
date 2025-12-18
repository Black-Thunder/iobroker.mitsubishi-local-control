# Mitsubishi Local Control Adapter - User guide

## Requirements

To use this adapter, the following requirements must be met:

- Mitsubishi Electric air conditioner with **local network interface** via Wi-Fi adapter MAC-577IF-2E
- Device reachable via IP address
- Local network connectivity between ioBroker and the device

## Configuration

### Device Configuration

Each adapter instance can manage **multiple devices**.

For each device the following parameters are required:

| Parameter  | Description                   |
| ---------- | ----------------------------- |
| Name       | Friendly device name          |
| IP address | IP (or IP:port) of the device |

### Polling Interval

The polling interval defines how often the adapter fetches the current device state.

- Polling starts **immediately** after adapter startup
- Polling failures automatically mark the device as offline
- Successful polling updates all states and marks the device as online

## Object Structure

After the adapter instance has started successfully, the following object structure is created.

### `mitsubishi-local-control.X`

Adapter instance root.

### `mitsubishi-local-control.X.devices.<deviceId>`

Device channel.  
The device ID is derived from the device MAC address.

### Device Information

#### `...info`

| State                    | Type    | Description |                                        |
| ------------------------ | ------- | ----------- | -------------------------------------- |
| appVersion               | string  | ✔           | App version                            |
| autoMode                 | number  | ✔           | Current auto mode of the device        |
| coarseTemperature        | number  | ✔           | Coarse temperature reading             |
| deviceOnline             | boolean | ✔           | Indicates if device is reachable       |
| energyHectoWattHour      | number  | ✔           | Energy consumption in hecto-watt-hours |
| errorCode                | number  | ✔           | Current error code of the device       |
| hasError                 | boolean | ✔           | Indicates if device has an error       |
| iSeeSensor               | boolean | ✔           | iSee sensor status                     |
| insideTemperature1Coarse | number  | ✔           | Coarse reading of inside temperature 1 |
| insideTemperature1Fine   | number  | ✔           | Fine reading of inside temperature 1   |
| insideTemperature2       | number  | ✔           | Inside temperature 2                   |
| ip                       | string  | ✔           | Device IP address                      |
| mac                      | string  | ✔           | Device MAC address                     |
| operating                | boolean | ✔           | Device operating status                |
| outsideTemperature       | number  | ✔           | Outside temperature                    |
| powerMode                | string  | ✔           | Current power mode                     |
| powerWatt                | number  | ✔           | Current power consumption in watts     |
| rssi                     | number  | ✔           | Wi-Fi signal strength (RSSI)           |
| runtimeMinutes           | number  | ✔           | Total runtime of the device in minutes |
| serial                   | string  | ✔           | Device serial number                   |
| wideVaneAdjustment       | boolean | ✔           | Wide vane adjustment                   |
| windAndWindBreakDirect   | number  | ✔           | Wind and windbreak direction           |

### Device Control

#### `...control`

| State                   | Type    | Writable | Description                                              |
| ----------------------- | ------- | :------: | -------------------------------------------------------- |
| buzzer                  | boolean |    ✔     | Trigger device buzzer                                    |
| dehumidifierLevel       | boolean |    ✔     | Dehumidifier control (adjustable level 0–100 %)          |
| enableEchonet           | boolean |    ✔     | Enable/disable ECHONET protocol                          |
| fanSpeed                | number  |    ✔     | Fan speed                                                |
| operationMode           | number  |    ✔     | Operation mode                                           |
| power                   | boolean |    ✔     | Turn device on/off                                       |
| powerSaving             | boolean |    ✔     | Power saving mode (enable/disable energy saving)         |
| rebootDevice            | boolean |    ✔     | Reboot device                                            |
| remoteLock              | number  |    ✔     | Remote lock power, operation mode or temperature setting |
| temperature             | number  |    ✔     | Target temperature                                       |
| vaneVerticalDirection   | number  |    ✔     | Vertical vane direction                                  |
| vaneHorizontalDirection | number  |    ✔     | Horizontal vane direction                                |

## Device Online Detection

The adapter automatically determines the online state:

- ✔ `online = true` if polling succeeds
- ❌ `online = false` if polling fails or times out

This allows easy monitoring and automation based on device availability.
