let twitch = {};
let client_id;
let token = "";
let dcf_interval;
let subscriptions = {};
twitch.status = "init";
twitch.user_code = "";
twitch.user_url = "";

twitch.init = async function (new_client_id, scopes = []) {
    client_id = new_client_id;
    token = localStorage.getItem(client_id + "_twitch_token");
    if (await validateToken(token, scopes)) {
        console.log("The Token we have is valid and we are happy.");
        twitch.status = "ready";
        return true;
    } else {
        console.log("The Token we have is not valid and we need to set things up to continue.");
    }
    let data = new URLSearchParams();
    data.set("client_id", client_id);
    data.set("scopes", scopes.join(" "));
    let setupResponse = await fetch("https://id.twitch.tv/oauth2/device", {
        body: data,
        method: "POST"
    });
    let setupData = await setupResponse.json();
    console.log("Setup Data:", JSON.stringify(setupData));
    twitch.status = "waiting_for_code";
    twitch.user_code = setupData.user_code;
    twitch.user_url = setupData.verification_uri;
    dcf_interval = setInterval(async () => {
        await fetchTokenFromCode(setupData.device_code, scopes);
    }, setupData.interval * 1000);
    return false;
}

async function fetchTokenFromCode(device_code, scopes) {
    let data = new URLSearchParams();
    data.set("client_id", client_id);
    data.set("scopes", scopes.join(" "));
    data.set("device_code", device_code);
    data.set("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
    let tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
        body: data,
        method: "POST"
    });
    if (tokenResponse.ok) {
        console.log("We got a token!");
        let tokenData = await tokenResponse.json();
        console.log(JSON.stringify(tokenData));
        clearInterval(dcf_interval);
        token = tokenData.access_token;
        localStorage.setItem(client_id + "_twitch_token", token);
        localStorage.setItem(client_id + "_twitch_refresh_token", tokenData.refresh_token);
        twitch.status = "ready";
    } else {
        console.log("We are still waiting for a token...");
    }

}

async function refreshToken(refresh_token) {
    // TO BE IMPLEMENTED, cba right now.
}

async function validateToken(token, scopes = []) {
    let response = await fetch("https://id.twitch.tv/oauth2/validate", {
        method: "GET",
        headers: {
            "Authorization": "OAuth " + token
        }
    });
    let responseData = await response.json();
    if (response.ok) {
        if (responseData.client_id === client_id) {
            for (let scope of scopes) {
                if (!responseData.includes(scope)) {
                    console.log("Missing requested scope", scope);
                    return false;
                }
            }
            return true;
        } else {
            console.log("Token's Client ID and requested Client ID do not match.");
            return false;
        }
    } else {
        return false;
    }
}

twitch.subscribeToTopic = async function (topic, websocket_id, version, condition, callback) {
    let subResponse = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + token,
            "Client-ID": client_id,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type: topic,
            condition: condition,
            version: version,
            transport: {
                method: "websocket",
                session_id: websocket_id
            }
        })
    });
    if (subResponse.ok) {
        let subData = await subResponse.json();
        subscriptions[subData.data[0].id] = callback;
    }
    return subResponse.ok;
}

twitch.connectToWebSocket = async function () {
    let ws = new WebSocket("wss://eventsub.wss.twitch.tv/ws");
    return new Promise((resolve) => {
        ws.onmessage = async (data) => {
            let jsonData = JSON.parse(data.data);
            switch (jsonData.metadata.message_type) {
                case "session_welcome": {
                    resolve(jsonData.payload.session.id);
                    break;
                }
                case "session_keepalive": {
                    console.log("Got a keepalive...");
                    break;
                }
                case "notification": {
                    subscriptions[payload.subscription.id]();
                    break;
                }
                default: {
                    console.log("Unknown message type:", jsonData.metadata.message_type);
                    console.log(data.data);
                }
            }
        };
    });
}

export {twitch};
