import {ProtocolConstants} from './protocol.mjs';

export const SettingsDefaults = {
    host: `https://${ProtocolConstants.defaultHost}`,
    expiresInSeconds: ProtocolConstants.defaultDuration * 24 * 60 * 60,
};
