import { MitsubishiController } from "./mitsubishiController";

interface Device {
	name: string;
	ip: string;
	mac: string | undefined;
	controller: MitsubishiController;
	pollingJob?: NodeJS.Timeout;
}

export { Device };
