var DOTENV = require('dotenv');
DOTENV.config();
var PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
var VERIFY_TOKEN = process.env.VERIFY_TOKEN;
var PREFIX = process.env.PREFIX;
var request = require('request'), express = require('express'), bodyParser = require('body-parser'), app = express().use(bodyParser.json());
app.listen(process.env.PORT || 1337, function () {
    console.log('webhook is listening');
});
app.post('/webhook', function (req, res) {
    var body = req.body;
    if (body.object === 'page') {
        body.entry.forEach(function (entry) {
            var webhook_event = entry.messaging[0];
            console.log(webhook_event);
            var sender_psid = webhook_event.sender.id;
            console.log("Sender ID: " + sender_psid);
            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            }
            else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    }
    else {
        res.sendStatus(404);
    }
});
app.get("/webhook", function (req, res) {
    var mode = req.query["hub.mode"];
    var token = req.query["hub.verify_token"];
    var challenge = req.query["hub.challenge"];
    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        }
        else {
            res.sendStatus(403);
        }
    }
});
function handleMessage(sender_psid, received_message) {
    var response;
    if (received_message.text) {
        var message = on_message_handler(sender_psid, received_message.text);
        if (message.consumed && message.text === null && message.response !== null) {
            response = message.response;
        }
        else if (!message.consumed && message.text !== null && message.response === null) {
            response = command_handler(sender_psid, message.text);
        }
        ;
    }
    else if (received_message.attachments) {
        var attachment_url = received_message.attachments[0].payload.url;
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
                                    "payload": "yes"
                                },
                                {
                                    "type": "postback",
                                    "title": "No!",
                                    "payload": "no"
                                },
                            ]
                        },
                    ]
                }
            }
        };
    }
    callSendAPI(sender_psid, response);
}
function handlePostback(sender_psid, received_postback) {
    var response;
    var payload = received_postback.payload;
    if (payload === "yes") {
        response = { "text": "Thanks!" };
    }
    else if (payload === "no") {
        response = { "text": "Oops, try sending another image." };
    }
    callSendAPI(sender_psid, response);
}
function callSendAPI(sender_psid, response) {
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response,
    };

    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent');
        }
        else {
            console.error("Unable to send message:" + err);
        }
    });
}
function on_message_handler(sender_psid, message) {
    var response = {
        text: message,
        consumed: false,
        response: null
    };
    return response;
}
function command_handler(sender_psid, message) {
    var AVAILABLE_COMMANDS = [
        "help",
    ];
    var COMMAND_PATTERN = new RegExp("^".concat(PREFIX, "([a-z0-9_]+)"), 'i');
    var commands = COMMAND_PATTERN.exec(message);
    var command = null;
    if (commands !== null) {
        command = commands[0];
    }
    var response;
    if (command === null || !AVAILABLE_COMMANDS.includes(command)) {
        response = {
            text: "Sorry, there are no such commands. Try using ".concat(PREFIX, "help.")
        };
    }
    if (command === "".concat(PREFIX, "help")) {
        response = {
            text: "Available commands:\n\n".concat(AVAILABLE_COMMANDS.join('\n'), "\n")
        };
    }
    return response;
}
