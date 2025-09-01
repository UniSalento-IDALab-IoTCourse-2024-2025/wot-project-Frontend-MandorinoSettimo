// constants/ApiConfig.ts


export const HOST_LOCAL = "192.168.1.4";
export const HOST_EC2 = "https://5eac5vf73f.execute-api.us-east-1.amazonaws.com/dev/api"
export const MQTT_HOST = "107.22.89.165";  // es: "ec2-3-91-…compute.amazonaws.com"

export const PORTS = {
    position: 8088,
    delivery: 8087,
    notification: 8089,
    mqttWs: 9001,
};

/*export const ApiConfig = {
    POSITION_SERVICE: `http://${HOST_LOCAL}:${PORTS.position}/api`,
    DELIVERY_SERVICE: `http://${HOST_LOCAL}:${PORTS.delivery}/api`,
    NOTIFICATION_SERVICE: `http://${HOST_LOCAL}:${PORTS.notification}/api`,
    MQTT_WS: `ws://${HOST_LOCAL}:${PORTS.mqttWs}`,
};*/

export const ApiConfig = {
    POSITION_SERVICE: `${HOST_EC2}`,
    DELIVERY_SERVICE: `${HOST_EC2}`,
    NOTIFICATION_SERVICE: `${HOST_EC2}`,
    MQTT_WS: `ws://${MQTT_HOST}:${PORTS.mqttWs}`,
};




// ipconfig getifaddr en0   # su macOS con Wi-Fi

