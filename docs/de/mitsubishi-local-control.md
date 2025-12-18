# Mitsubishi Local Control Adapter – Benutzerhandbuch

## Voraussetzungen

Um diesen Adapter nutzen zu können, müssen folgende Voraussetzungen erfüllt sein:

- Mitsubishi Electric Klimagerät mit **lokaler Netzwerkschnittstelle** über den Wi-Fi-Adapter MAC-577IF-2E
- Gerät ist über eine IP-Adresse erreichbar
- Lokale Netzwerkverbindung zwischen ioBroker und dem Gerät

## Konfiguration

### Gerätekonfiguration

Jede Adapter-Instanz kann **mehrere Geräte** verwalten.

Für jedes Gerät sind folgende Parameter erforderlich:

| Parameter  | Beschreibung                 |
| ---------- | ---------------------------- |
| Name       | Anzeigename des Geräts       |
| IP-Adresse | IP (oder IP:Port) des Geräts |

### Polling-Intervall

Das Polling-Intervall definiert, wie häufig der Adapter den aktuellen Gerätestatus abruft.

- Das Polling startet **sofort** nach dem Start des Adapters
- Polling-Fehler markieren das Gerät automatisch als offline
- Erfolgreiches Polling aktualisiert alle Zustände und markiert das Gerät als online

## Objektstruktur

Nachdem die Adapter-Instanz erfolgreich gestartet wurde, wird folgende Objektstruktur erstellt.

### `mitsubishi-local-control.X`

Wurzel der Adapter-Instanz.

### `mitsubishi-local-control.X.devices.<deviceId>`

Geräte-Channel.  
Die Geräte-ID wird aus der MAC-Adresse des Geräts abgeleitet.

### Geräteinformationen

#### `...info`

| State                    | Typ     | Beschreibung |                                         |
| ------------------------ | ------- | ------------ | --------------------------------------- |
| appVersion               | string  | ✔            | App-Version                             |
| autoMode                 | number  | ✔            | Aktueller Automatikmodus des Geräts     |
| coarseTemperature        | number  | ✔            | Grobe Temperaturmessung                 |
| deviceOnline             | boolean | ✔            | Zeigt an, ob das Gerät erreichbar ist   |
| energyHectoWattHour      | number  | ✔            | Energieverbrauch in Hekto-Wattstunden   |
| errorCode                | number  | ✔            | Aktueller Fehlercode des Geräts         |
| hasError                 | boolean | ✔            | Zeigt an, ob das Gerät einen Fehler hat |
| iSeeSensor               | boolean | ✔            | Status des iSee-Sensors                 |
| insideTemperature1Coarse | number  | ✔            | Grobe Messung der Innentemperatur 1     |
| insideTemperature1Fine   | number  | ✔            | Feine Messung der Innentemperatur 1     |
| insideTemperature2       | number  | ✔            | Innentemperatur 2                       |
| ip                       | string  | ✔            | IP-Adresse des Geräts                   |
| mac                      | string  | ✔            | MAC-Adresse des Geräts                  |
| operating                | boolean | ✔            | Betriebsstatus des Geräts               |
| outsideTemperature       | number  | ✔            | Außentemperatur                         |
| powerMode                | string  | ✔            | Aktueller Energiemodus                  |
| powerWatt                | number  | ✔            | Aktueller Stromverbrauch in Watt        |
| rssi                     | number  | ✔            | WLAN-Signalstärke (RSSI)                |
| runtimeMinutes           | number  | ✔            | Gesamtlaufzeit des Geräts in Minuten    |
| serial                   | string  | ✔            | Seriennummer des Geräts                 |
| wideVaneAdjustment       | boolean | ✔            | Breite Lamellenverstellung              |
| windAndWindBreakDirect   | number  | ✔            | Wind- und Windschutzrichtung            |

### Gerätesteuerung

#### `...control`

| State                   | Typ     | Schreibbar | Beschreibung                                                   |
| ----------------------- | ------- | :--------: | -------------------------------------------------------------- |
| buzzer                  | boolean |     ✔      | Geräteton (Buzzer) auslösen                                    |
| dehumidifierLevel       | boolean |     ✔      | Luftentfeuchtersteuerung (einstellbarer Wert 0–100 %)          |
| enableEchonet           | boolean |     ✔      | ECHONET-Protokoll ein-/ausschalten                             |
| fanSpeed                | number  |     ✔      | Lüfterstufe                                                    |
| operationMode           | number  |     ✔      | Betriebsmodus                                                  |
| power                   | boolean |     ✔      | Gerät ein-/ausschalten                                         |
| powerSaving             | boolean |     ✔      | Energiesparmodus (Energieeinsparung aktivieren/deaktivieren)   |
| rebootDevice            | boolean |     ✔      | Gerät neustarten                                               |
| remoteLock              | number  |     ✔      | Fernsperre für Power, Betriebsmodus oder Temperatureinstellung |
| temperature             | number  |     ✔      | Solltemperatur                                                 |
| vaneVerticalDirection   | number  |     ✔      | Vertikale Lamellenrichtung                                     |
| vaneHorizontalDirection | number  |     ✔      | Horizontale Lamellenrichtung                                   |

## Erkennung des Online-Status

Der Adapter ermittelt den Online-Status automatisch:

- ✔ `online = true`, wenn das Polling erfolgreich ist
- ❌ `online = false`, wenn das Polling fehlschlägt oder ein Timeout auftritt

Dies ermöglicht eine einfache Überwachung und Automatisierung basierend auf der Erreichbarkeit des Geräts.
