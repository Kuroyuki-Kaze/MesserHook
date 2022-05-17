"use strict";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
// Imports dependencies and set up http server
const request = require("request"),
  express = require("express"),
  body_parser = require("body-parser"),
  app = express().use(body_parser.json()); // creates express http server

// test commit

const NodeCache = require("node-cache");
const cached_id = new NodeCache();

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

// Accepts POST requests at /webhook endpoint
app.post("/webhook", (req, res) => {
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === "page") {
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log("Sender PSID: " + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    // Return a '200 OK' response to all events
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Accepts GET requests at the /webhook endpoint
app.get("/webhook", (req, res) => {
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "VerySpookyScarySkeletonThatSometimesWillCrawlOnYourBed";

  // Parse params from the webhook verification request
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

function handleMessage(sender_psid, received_message) {
  let response;
  
  if (cached_id.get(sender_psid) == undefined) {
    cached_id.set(sender_psid, {
      game_in_progress: false,
      hand: 0
    }, 600);
  }
  
  let game_in_progress = cached_id.get(sender_psid)["game_in_progress"]
  let hand = cached_id.get(sender_psid)["hand"]

  // Checks if the message contains text
  if (received_message.text) {
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API
    if ((received_message.text === "Start Game" || received_message.text === "Start game") && !game_in_progress) {
      game_in_progress = true;
      hand = Math.floor(Math.random() * 3);
      
      cached_id.set(sender_psid, {
        game_in_progress: game_in_progress,
        hand: hand
      }, 600);
      
      response = {
        text: "Rock Paper Scissors?"
      };
    } else if (game_in_progress) {
      let player_hand;
      if (received_message.text === "rock" || received_message.text === "Rock") {
        player_hand = 0;
      } else if (received_message.text === "paper" || received_message.text === "Paper") {
        player_hand = 1;
      } else if (received_message.text === "scissors" || received_message.text === "scissors") {
        player_hand = 2;
      } else {
        player_hand = -1;
      }
      
      if (player_hand === 0) {
        if (hand === 0) {
          response = {
            text: "Draw!"
          };
        } else if (hand === 1) {
          response = {
            text: "You lose!"
          };
        } else if (hand === 2) {
          response = {
            text: "You win!"
          };
        } else {
          response = {
            text: "You're not supposed to trigger this text"
          };
        }
      } else if (player_hand === 1) {
        if (hand === 0) {
          response = {
            text: "You win!"
          };
        } else if (hand === 1) {
          response = {
            text: "Draw!"
          };
        } else if (hand === 2) {
          response = {
            text: "You lose!"
          };
        } else {
          response = {
            text: "You're not supposed to trigger this text"
          };
        }
      } else if (player_hand === 2) {
        if (hand === 0) {
          response = {
            text: "You lose!"
          };
        } else if (hand === 1) {
          response = {
            text: "You win!"
          };
        } else if (hand === 2) {
          response = {
            text: "Draw!"
          };
        } else {
          response = {
            text: "You're not supposed to trigger this text"
          };
        }
      } else {
        response = {
          text: "I have no idea what you just played, so I will just end the game."
        };
      }
      
      game_in_progress = false;
      
      cached_id.set(sender_psid, {
        game_in_progress: game_in_progress,
        hand: hand
      }, 600);
    } else {
      response = {
        text: "I have no idea what you're saying. Try `Start Game` to play a game of rock-paper-scissors with me."
      };
    }
  } else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "Is this the right picture?",
              subtitle: "Tap a button to answer.",
              image_url: attachment_url,
              buttons: [
                {
                  type: "postback",
                  title: "Yes!",
                  payload: "yes",
                },
                {
                  type: "postback",
                  title: "No!",
                  payload: "no",
                },
              ],
            },
          ],
        },
      },
    };
  }

  // Send the response message
  callSendAPI(sender_psid, response);
}

function handlePostback(sender_psid, received_postback) {
  let response;

  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === "yes") {
    response = { text: "Thanks!" };
  } else if (payload === "no") {
    response = { text: "Oops, try sending another image." };
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid,
    },
    message: response,
  };

  // Send the HTTP request to the Messenger Platform
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body,
    },
    (err, res, body) => {
      if (!err) {
        console.log("message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}
