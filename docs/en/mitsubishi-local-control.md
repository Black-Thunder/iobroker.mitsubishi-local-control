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

| State       | Type    | Description                               |
| ----------- | ------- | ----------------------------------------- |
| mac         | string  | Device MAC address                        |
| serial      | string  | Device serial number                      |
| ip          | string  | Device IP address                         |
| rssi        | string  | Wi-Fi signal strength                     |
| app_version | string  | Firmware / application version            |
| online      | boolean | Indicates if the device is reachable      |
| hasError    | boolean | Indicates if the device is in error state |

### Device Control

#### `...control`

| State                   | Type    | Writable | Description                                              |
| ----------------------- | ------- | :------: | -------------------------------------------------------- |
| power                   | boolean |    ✔     | Turn device on/off                                       |
| operationMode           | number  |    ✔     | Operation mode                                           |
| remoteLock              | number  |    ✔     | Remote lock power, operation mode or temperature setting |
| temperature             | number  |    ✔     | Target temperature                                       |
| fanSpeed                | number  |    ✔     | Fan speed                                                |
| vaneVerticalDirection   | number  |    ✔     | Vertical vane direction                                  |
| vaneHorizontalDirection | number  |    ✔     | Horizontal vane direction                                |
| buzzer                  | boolean |    ✔     | Trigger device buzzer                                    |

## Device Online Detection

The adapter automatically determines the online state:

- ✔ `online = true` if polling succeeds
- ❌ `online = false` if polling fails or times out

This allows easy monitoring and automation based on device availability.
