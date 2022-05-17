const DOTENV = require('dotenv');
DOTENV.config();

const PAGE_ACCESS_TOKEN: string = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN: string = process.env.VERIFY_TOKEN;
const PREFIX: string = process.env.PREFIX;

const request = require('request'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express().use(bodyParser.json());

app.listen(process.env.PORT || 1337, () => {
    console.log('webhook is listening');
});

app.post('/webhook', (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(entry => {
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            let sender_psid = webhook_event.sender.id;
            console.log("Sender ID: " + sender_psid);

            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }
        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

app.get("/webhook", (req, res) => {
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

function handleMessage(sender_psid: number, received_message): void {
    let response: {
        text: string
    } | {
        attachment: {
            type: string,
            payload: {
                template_type: string,
                elements: {
                    title: string,
                    subtitle: string,
                    image_url: string,
                    buttons: {
                        type: string,
                        title: string,
                        payload: string,
                    }[],
                }[],
            }
        }
    };

    if (received_message.text) {
        let message: {
            text: string | null,
            consumed: boolean,
            response: {
                text: string
            } | null
        } = on_message_handler(sender_psid, received_message.text);

        if (message.consumed && message.text === null && message.response !== null) {
            response = message.response;
        } else if (
            !message.consumed && message.text !== null && message.response === null) {
            response = command_handler(sender_psid, message.text);
        };
    } else if (received_message.attachments) {
        let attachment_url = received_message.attachments[0].payload.url;
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [
                        {
                            "title": "Is this the right picture?",
                            "subtitle": "Tap a button to answer.",
                            "image_url": attachment_url,
                            "buttons": [
                                {
                                    "type": "postback",
                                    "title": "Yes!",
                                    "payload": "yes",
                                },
                                {
                                    "type": "postback",
                                    "title": "No!",
                                    "payload": "no",
                                },
                            ],
                        },
                    ],
                },
            },
        };
    }

    callSendAPI(sender_psid, response);
}

function handlePostback(sender_psid: number, received_postback): void {
    let response;

    let payload = received_postback.payload;

    if (payload === "yes") {
        response = { "text": "Thanks!" }
    }
    else if (payload === "no") {
        response = { "text": "Oops, try sending another image." }
    }

    callSendAPI(sender_psid, response);
}

function callSendAPI(sender_psid: number, response: {
    text: string,
} | {
    attachment: {
        type: string,
        payload: {
            template_type: string,
            elements: {
                title: string,
                subtitle: string,
                image_url: string,
                buttons: {
                    type: string,
                    title: string,
                    payload: string,
                }[],
            }[],
        }
    }
}): void {
    console.log("Sending message to PSID: " + sender_psid);
    console.log("Response: " + JSON.stringify(response));
}

function on_message_handler(sender_psid: number, message: string): {
    text: string | null,
    consumed: boolean,
    response: {
        text: string
    } | null
} {
    let response: {
        text: string | null,
        consumed: boolean,
        response: {
            text: string
        } | null
    } = {
        text: message,
        consumed: false,
        response: null,
    };

    return response;
}

function command_handler(sender_psid: number, message: string): {
    text: string
} {
    const AVAILABLE_COMMANDS: string[] = [
        "help",
    ]

    const COMMAND_PATTERN: RegExp = new RegExp(`^${PREFIX}([a-z0-9_]+)`, 'i');

    let commands: string[] | null = COMMAND_PATTERN.exec(message);
    let command: string | null = null;
    if (commands !== null) {
        command = commands[0];
    }


    let response: { text: string };

    if (command === null || !AVAILABLE_COMMANDS.includes(command)) {
        response = {
            text: `Sorry, there are no such commands. Try using ${PREFIX}help.`
        };
    }

    if (command === `${PREFIX}help`) {
        response = {
            text: `Available commands:\n\n${AVAILABLE_COMMANDS.join('\n')}\n`
        };
    }

    return response;
}