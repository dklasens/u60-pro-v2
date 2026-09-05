"""Identity contract shared by terminal unlock and deployment; never retain IMEI."""
import hashlib
import re


def device_identity(info):
    def field(names):
        return next((info[k].strip() for k in names if isinstance(info.get(k), str) and info[k].strip()), '')
    model = field(['model', 'model_name', 'device_name', 'product_name', 'modelName'])
    firmware = field(['software_version', 'sw_version', 'firmware_version', 'wa_inner_version', 'version'])
    if not model:
        stock = field(['wa_inner_version'])
        if stock.startswith('BD_') and 'MU5250V' in stock:
            model = 'ZTE MU5250'
    normalized = model.lower().replace(' ', '').replace('_', '').replace('-', '')
    imei = field(['imei'])
    if not ('mu5250' in normalized or 'u60pro' in normalized) or not firmware or not re.fullmatch('[0-9]{15}', imei):
        raise ValueError('Device identity or firmware could not be verified as a U60 Pro')
    return {'model': model, 'firmware': firmware, 'fingerprint': hashlib.sha256(imei.encode()).hexdigest()}
