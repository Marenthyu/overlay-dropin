import { twitch } from './twitch.js';

async function main() {
    let noSetupNeeded = await twitch.init("hz7aryki2odatzyqmswizmj9wjutby");
    if (!noSetupNeeded) {
        document.getElementById("twitchOutput").innerText = "Please head to " + twitch.user_url + " to authenticate!";
        let authInterval = setInterval(async () => {
            if (twitch.status === "ready") {
                clearInterval(authInterval);
                document.getElementById("twitchOutput").innerText = "You are authenticated!";
                await postauth();
            }
        })
    } else {
        document.getElementById("twitchOutput").innerText = "You are authenticated!";
        await postAuth();
    }
}

async function postAuth() {
    console.log("Well, we need a websocket now...");
    let websocket_id = await twitch.connectToWebSocket();
    console.log("Websocket ID:", websocket_id);
    await twitch.subscribeToTopic("stream.online", websocket_id, "1", {broadcaster_user_id: "48712659"}, (event) => {
        console.log(JSON.stringify(event));
    });
}

Promise.all([main()]).then(() => {
    console.log("Code ran.")
});
